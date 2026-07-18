import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type CodexModelCapability,
  createCatalogOrchestrationConfig,
  createModelRoleOrchestrationConfig,
  DEFAULT_ORCHESTRATION_CONFIG,
  OrchestrationConfigSchema,
  OrchestrationModelCompatibilityError,
  planAgentProfiles,
  validateCodexOrchestrationConfig,
} from "../src/runtimes/omniskill/orchestration";
import { WorkflowBundleManifestSchema } from "../src/runtimes/omniskill/workflow-bundles";

const manifest = WorkflowBundleManifestSchema.parse({
  schemaVersion: "0.1",
  kind: "team",
  name: "test-team",
  version: "1.0.0",
  description: "Team with orchestration.",
  coordinator: "./skills/coordinator",
  members: ["catalog:cto"],
  orchestration: {
    roles: {
      "./skills/coordinator": {
        tier: "deep",
        access: "read-only",
        consultation: "receive",
      },
      "catalog:cto": {
        tier: "deep",
        access: "read-only",
        consultation: "request",
      },
      "mattpocock:implement": {
        tier: "standard",
        access: "workspace-write",
        consultation: "request",
      },
    },
    support: {
      explorer: {
        tier: "fast",
        access: "read-only",
        consultation: "request",
      },
    },
  },
  skills: [
    { source: "./skills/coordinator", entry: true },
    { source: "catalog:cto" },
    { source: "mattpocock:implement" },
  ],
  steps: [
    { id: "route", title: "Route", skill: "./skills/coordinator" },
    {
      id: "execute",
      title: "Implement",
      skill: "mattpocock:implement",
      phase: "implementation",
    },
  ],
});

const roleSkillNames = {
  "./skills/coordinator": "coordinator",
  "catalog:cto": "cto",
  "mattpocock:implement": "implement",
};

describe("orchestration configuration", () => {
  test("rejects empty candidates and silent tier downgrades", () => {
    expect(() =>
      OrchestrationConfigSchema.parse({
        ...DEFAULT_ORCHESTRATION_CONFIG,
        tiers: {
          ...DEFAULT_ORCHESTRATION_CONFIG.tiers,
          deep: { ...DEFAULT_ORCHESTRATION_CONFIG.tiers.deep, codex: [] },
        },
      }),
    ).toThrow();
    expect(() =>
      OrchestrationConfigSchema.parse({
        ...DEFAULT_ORCHESTRATION_CONFIG,
        tiers: {
          ...DEFAULT_ORCHESTRATION_CONFIG.tiers,
          deep: {
            ...DEFAULT_ORCHESTRATION_CONFIG.tiers.deep,
            claude: [{ model: "opus\nextra: injected", effort: "high" }],
          },
        },
      }),
    ).toThrow();
    expect(() =>
      OrchestrationConfigSchema.parse({
        ...DEFAULT_ORCHESTRATION_CONFIG,
        tiers: {
          ...DEFAULT_ORCHESTRATION_CONFIG.tiers,
          turbo: DEFAULT_ORCHESTRATION_CONFIG.tiers.fast,
        },
      }),
    ).toThrow();
    expect(() =>
      OrchestrationConfigSchema.parse({
        ...DEFAULT_ORCHESTRATION_CONFIG,
        policy: {
          ...DEFAULT_ORCHESTRATION_CONFIG.policy,
          lowerTierFallback: "automatic",
        },
      }),
    ).toThrow();
  });

  test("rejects duplicate candidates", () => {
    expect(() =>
      OrchestrationConfigSchema.parse({
        ...DEFAULT_ORCHESTRATION_CONFIG,
        tiers: {
          ...DEFAULT_ORCHESTRATION_CONFIG.tiers,
          deep: {
            ...DEFAULT_ORCHESTRATION_CONFIG.tiers.deep,
            codex: [
              { model: "gpt-5.6", reasoningEffort: "high" },
              { model: "gpt-5.6", reasoningEffort: "high" },
            ],
          },
        },
      }),
    ).toThrow("Duplicate deep codex orchestration candidate: gpt-5.6/high");
  });

  test("selects the highest-priority visible Codex model supporting each tier effort", () => {
    const catalog = [
      {
        slug: "gpt-high",
        visibility: "list",
        priority: 0,
        supportedReasoningEfforts: ["high"],
      },
      {
        slug: "gpt-general",
        visibility: "list",
        priority: 1,
        supportedReasoningEfforts: ["low", "medium"],
      },
      {
        slug: "gpt-medium",
        visibility: "list",
        priority: 0,
        supportedReasoningEfforts: ["medium"],
      },
      {
        slug: "gpt-hidden",
        visibility: "hidden",
        priority: -1,
        supportedReasoningEfforts: ["low", "medium", "high"],
      },
    ] satisfies CodexModelCapability[];

    expect(createCatalogOrchestrationConfig(catalog).tiers).toEqual({
      deep: {
        codex: [{ model: "gpt-high", reasoningEffort: "high" }],
        claude: DEFAULT_ORCHESTRATION_CONFIG.tiers.deep.claude,
      },
      standard: {
        codex: [{ model: "gpt-medium", reasoningEffort: "medium" }],
        claude: DEFAULT_ORCHESTRATION_CONFIG.tiers.standard.claude,
      },
      fast: {
        codex: [{ model: "gpt-general", reasoningEffort: "low" }],
        claude: DEFAULT_ORCHESTRATION_CONFIG.tiers.fast.claude,
      },
    });
  });

  test("prefers GPT-5.6 tier defaults over higher-priority GPT-5.5", () => {
    const catalog = [
      {
        slug: "gpt-5.5",
        visibility: "list",
        priority: 0,
        supportedReasoningEfforts: ["low", "medium", "high"],
      },
      {
        slug: "gpt-5.6-sol",
        visibility: "list",
        priority: 1,
        supportedReasoningEfforts: ["medium", "high"],
      },
      {
        slug: "gpt-5.6-terra",
        visibility: "list",
        priority: 2,
        supportedReasoningEfforts: ["low"],
      },
    ] satisfies CodexModelCapability[];

    expect(createCatalogOrchestrationConfig(catalog).tiers).toEqual({
      deep: {
        codex: [{ model: "gpt-5.6-sol", reasoningEffort: "high" }],
        claude: DEFAULT_ORCHESTRATION_CONFIG.tiers.deep.claude,
      },
      standard: {
        codex: [{ model: "gpt-5.6-sol", reasoningEffort: "medium" }],
        claude: DEFAULT_ORCHESTRATION_CONFIG.tiers.standard.claude,
      },
      fast: {
        codex: [{ model: "gpt-5.6-terra", reasoningEffort: "low" }],
        claude: DEFAULT_ORCHESTRATION_CONFIG.tiers.fast.claude,
      },
    });
  });

  test("reports when no visible model supports a required tier effort", () => {
    try {
      createCatalogOrchestrationConfig([
        {
          slug: "gpt-medium",
          visibility: "list",
          priority: 0,
          supportedReasoningEfforts: ["low", "medium"],
        },
      ]);
      throw new Error("Expected a tier effort compatibility error");
    } catch (error) {
      expect(error).toBeInstanceOf(OrchestrationModelCompatibilityError);
      expect((error as OrchestrationModelCompatibilityError).code).toBe("tier_effort_unavailable");
      expect((error as Error).message).toContain("deep requires Codex effort high");
    }
  });

  test("rejects unavailable models in custom Codex configuration", () => {
    const customConfig = OrchestrationConfigSchema.parse({
      ...DEFAULT_ORCHESTRATION_CONFIG,
      tiers: {
        ...DEFAULT_ORCHESTRATION_CONFIG.tiers,
        deep: {
          ...DEFAULT_ORCHESTRATION_CONFIG.tiers.deep,
          codex: [{ model: "missing-model", reasoningEffort: "high" }],
        },
      },
    });

    try {
      validateCodexOrchestrationConfig(customConfig, [
        {
          slug: "gpt-5.5",
          visibility: "list",
          priority: 0,
          supportedReasoningEfforts: ["low", "medium", "high"],
        },
      ]);
      throw new Error("Expected a model compatibility error");
    } catch (error) {
      expect(error).toBeInstanceOf(OrchestrationModelCompatibilityError);
      expect((error as OrchestrationModelCompatibilityError).code).toBe("model_unavailable");
      expect((error as Error).message).toContain("deep Codex model missing-model is unavailable");
    }
  });

  test("rejects unsupported efforts in custom Codex configuration", () => {
    try {
      validateCodexOrchestrationConfig(DEFAULT_ORCHESTRATION_CONFIG, [
        {
          slug: "gpt-5.6-sol",
          visibility: "list",
          priority: 0,
          supportedReasoningEfforts: ["low", "medium"],
        },
        {
          slug: "gpt-5.6-terra",
          visibility: "list",
          priority: 1,
          supportedReasoningEfforts: ["low"],
        },
      ]);
      throw new Error("Expected an effort compatibility error");
    } catch (error) {
      expect(error).toBeInstanceOf(OrchestrationModelCompatibilityError);
      expect((error as OrchestrationModelCompatibilityError).code).toBe("effort_unsupported");
      expect((error as Error).message).toContain("gpt-5.6-sol does not support effort high");
    }
  });

  test("renders deterministic Codex and Claude profiles", () => {
    const profiles = planAgentProfiles({
      manifest,
      config: DEFAULT_ORCHESTRATION_CONFIG,
      homeDir: "/tmp/orchestration-home",
      targets: ["codex", "claude"],
      roleSkillNames,
    });

    expect(profiles.map(({ profileId, target, tier }) => ({ profileId, target, tier }))).toEqual([
      { profileId: "omniskills-test-team-coordinator", target: "claude", tier: "deep" },
      { profileId: "omniskills-test-team-coordinator", target: "codex", tier: "deep" },
      { profileId: "omniskills-test-team-cto", target: "claude", tier: "deep" },
      { profileId: "omniskills-test-team-cto", target: "codex", tier: "deep" },
      { profileId: "omniskills-test-team-explorer", target: "claude", tier: "fast" },
      { profileId: "omniskills-test-team-explorer", target: "codex", tier: "fast" },
      { profileId: "omniskills-test-team-implement", target: "claude", tier: "standard" },
      { profileId: "omniskills-test-team-implement", target: "codex", tier: "standard" },
    ]);
    expect(profiles.find(({ target }) => target === "codex")?.content).toContain(
      'model = "gpt-5.6-sol"',
    );
    expect(profiles.find(({ target }) => target === "claude")?.content).toContain("model: opus");
    expect(profiles.find(({ source }) => source === "catalog:cto")?.content).toContain(
      "Consult at most 2 time(s)",
    );
    expect(profiles.find(({ source }) => source === "catalog:cto")?.content).toContain(
      "Reject a repeated consultation without new evidence",
    );
    expect(profiles.find(({ source }) => source === "catalog:cto")?.content).toContain(
      "Never expand scope, bypass an approval gate, change permissions, or downgrade a tier",
    );
    expect(profiles.find(({ source }) => source === "catalog:cto")?.content).toContain(
      "When native messaging is unavailable, return the same structured consultation request as your result and stop",
    );
    expect(profiles.find(({ source }) => source === "catalog:cto")?.content).toContain(
      "load and follow the installed `$cto` skill",
    );
    expect(profiles.find(({ source }) => source === "catalog:cto")?.instructions).toContain(
      "load and follow the installed `$cto` skill",
    );
    expect(profiles.find(({ source }) => source === "catalog:cto")?.consultation).toBe("request");
    expect(profiles.find(({ source }) => source === "catalog:cto")?.limits).toEqual(
      DEFAULT_ORCHESTRATION_CONFIG.limits,
    );
    expect(profiles.find(({ source }) => source === "catalog:cto")?.content).toContain(
      "omniskills-managed: team=test-team source=catalog:cto",
    );
    expect(profiles.find(({ source }) => source === "catalog:cto")?.taskClass).toBe("role");
    expect(profiles.find(({ source }) => source === "explorer")?.taskClass).toBe("support");
    const readOnlyClaude = profiles.find(
      ({ source, target }) => source === "catalog:cto" && target === "claude",
    );
    expect(readOnlyClaude?.content).toContain("tools: Read, Glob, Grep, SendMessage");
    expect(readOnlyClaude?.content).not.toContain("Bash");
    expect(profiles.find(({ source }) => source === "mattpocock:implement")?.content).toContain(
      "Workspace-write tools are authorized only while executing an explicitly assigned implementation step",
    );
    expect(profiles.every(({ contentHash }) => /^sha256:[a-f0-9]{64}$/.test(contentHash))).toBe(
      true,
    );
    expect(profiles.find(({ target }) => target === "codex")?.destination).toBe(
      join("/tmp/orchestration-home", ".codex", "agents", "omniskills-test-team-coordinator.toml"),
    );
  });

  test("routes labeled Codex profiles through model roles", () => {
    const labeled = WorkflowBundleManifestSchema.parse({
      ...manifest,
      orchestration: {
        ...manifest.orchestration,
        roles: Object.fromEntries(
          Object.entries(manifest.orchestration?.roles ?? {}).map(([source, assignment]) => [
            source,
            {
              ...assignment,
              modelRole: source === "mattpocock:implement" ? "implementation" : "planning",
            },
          ]),
        ),
      },
    });
    const config = createModelRoleOrchestrationConfig({
      config: DEFAULT_ORCHESTRATION_CONFIG,
      selections: {
        planning: { model: "planner", reasoningEffort: "high" },
        implementation: { model: "builder", reasoningEffort: "medium" },
        verification: { model: "verifier", reasoningEffort: "high" },
      },
    });

    const profiles = planAgentProfiles({
      manifest: labeled,
      config,
      homeDir: "/tmp/orchestration-home",
      targets: ["codex"],
      roleSkillNames,
    });

    expect(profiles.find(({ source }) => source === "catalog:cto")).toMatchObject({
      modelRole: "planning",
      model: "planner",
      effort: "high",
    });
    expect(profiles.find(({ source }) => source === "mattpocock:implement")).toMatchObject({
      modelRole: "implementation",
      model: "builder",
      effort: "medium",
    });
  });

  test("uses model roles only for Codex profiles", () => {
    const labeled = WorkflowBundleManifestSchema.parse({
      ...manifest,
      orchestration: {
        ...manifest.orchestration,
        roles: {
          ...manifest.orchestration?.roles,
          "catalog:cto": {
            tier: "deep",
            modelRole: "planning",
            access: "read-only",
            consultation: "request",
          },
        },
      },
    });
    const config = createModelRoleOrchestrationConfig({
      config: DEFAULT_ORCHESTRATION_CONFIG,
      selections: {
        planning: { model: "planner", reasoningEffort: "high" },
        implementation: { model: "builder", reasoningEffort: "medium" },
        verification: { model: "verifier", reasoningEffort: "high" },
      },
    });

    const profiles = planAgentProfiles({
      manifest: labeled,
      config,
      homeDir: "/tmp/orchestration-home",
      targets: ["codex", "claude"],
      roleSkillNames,
    });
    const codexProfile = profiles.find(
      ({ source, target }) => source === "catalog:cto" && target === "codex",
    );
    const claudeProfile = profiles.find(
      ({ source, target }) => source === "catalog:cto" && target === "claude",
    );

    expect(codexProfile).toMatchObject({
      modelRole: "planning",
      model: "planner",
      effort: "high",
    });
    expect(codexProfile?.instructions).toContain("Model role: planning.");
    expect(claudeProfile).toMatchObject({ model: "opus", effort: "high" });
    expect(claudeProfile).not.toHaveProperty("modelRole");
    expect(claudeProfile?.instructions).not.toContain("Model role:");
  });

  test("renders ordered same-tier fallback profiles", () => {
    const config = OrchestrationConfigSchema.parse({
      ...DEFAULT_ORCHESTRATION_CONFIG,
      tiers: {
        ...DEFAULT_ORCHESTRATION_CONFIG.tiers,
        deep: {
          ...DEFAULT_ORCHESTRATION_CONFIG.tiers.deep,
          codex: [
            { model: "gpt-5.6", reasoningEffort: "high" },
            { model: "gpt-5.4", reasoningEffort: "high" },
          ],
        },
      },
    });
    const profiles = planAgentProfiles({
      manifest,
      config,
      homeDir: "/tmp/orchestration-home",
      targets: ["codex"],
      roleSkillNames,
    });
    expect(
      profiles
        .filter(({ source }) => source === "catalog:cto")
        .map(({ profileId, model, candidateIndex }) => ({ profileId, model, candidateIndex })),
    ).toEqual([
      { profileId: "omniskills-test-team-cto", model: "gpt-5.6", candidateIndex: 0 },
      {
        profileId: "omniskills-test-team-cto-fallback-2",
        model: "gpt-5.4",
        candidateIndex: 1,
      },
    ]);
  });

  test("omits Claude messaging when consultation is disabled", () => {
    const noConsultationManifest = WorkflowBundleManifestSchema.parse({
      ...manifest,
      orchestration: {
        ...manifest.orchestration,
        roles: {
          ...manifest.orchestration?.roles,
          "catalog:cto": {
            tier: "deep",
            access: "read-only",
            consultation: "none",
          },
        },
      },
    });
    const profile = planAgentProfiles({
      manifest: noConsultationManifest,
      config: DEFAULT_ORCHESTRATION_CONFIG,
      homeDir: "/tmp/orchestration-home",
      targets: ["claude"],
      roleSkillNames,
    }).find(({ source }) => source === "catalog:cto");

    expect(profile?.content).not.toContain("SendMessage");
  });

  test("rejects sources that normalize to the same profile identifier", () => {
    const collidingManifest = WorkflowBundleManifestSchema.parse({
      ...manifest,
      skills: [...manifest.skills, { source: "other:cto" }],
      orchestration: {
        ...manifest.orchestration,
        roles: {
          ...manifest.orchestration?.roles,
          "other:cto": {
            tier: "deep",
            access: "read-only",
            consultation: "request",
          },
        },
      },
    });

    expect(() =>
      planAgentProfiles({
        manifest: collidingManifest,
        config: DEFAULT_ORCHESTRATION_CONFIG,
        homeDir: "/tmp/orchestration-home",
        targets: ["codex"],
        roleSkillNames: { ...roleSkillNames, "other:cto": "other-cto" },
      }),
    ).toThrow("Duplicate agent profile identifier: omniskills-test-team-cto");
  });

  test("rejects unsafe profile identity components", () => {
    const unsafeManifest = WorkflowBundleManifestSchema.parse({
      ...manifest,
      skills: [...manifest.skills, { source: "catalog:../escape" }],
      orchestration: {
        ...manifest.orchestration,
        roles: {
          ...manifest.orchestration?.roles,
          "catalog:../escape": {
            tier: "deep",
            access: "read-only",
            consultation: "request",
          },
        },
      },
    });

    expect(() =>
      planAgentProfiles({
        manifest: unsafeManifest,
        config: DEFAULT_ORCHESTRATION_CONFIG,
        homeDir: "/tmp/orchestration-home",
        targets: ["codex"],
        roleSkillNames: { ...roleSkillNames, "catalog:../escape": "escape" },
      }),
    ).toThrow("Unsafe agent profile identifier component: ../escape");
  });
});
