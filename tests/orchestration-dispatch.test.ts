import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { hashAgentProfileContent } from "../src/runtimes/omniskill/orchestration";
import {
  createDispatchAttemptSchedule,
  hasRepeatedConsultationEvidence,
  MAX_DISPATCH_TASK_BYTES,
  OrchestrationDispatchError,
  planOrchestrationDispatch,
} from "../src/runtimes/omniskill/orchestration-dispatch";
import {
  type InstalledWorkflowBundle,
  WorkflowBundleManifestSchema,
  type WorkflowInstallAgentProfileArtifact,
} from "../src/runtimes/omniskill/workflow-bundles";

const homeDir = "/tmp/orchestration-dispatch-home";
const cwd = "/tmp/orchestration-dispatch-project";
const codexCapability = {
  available: true,
  adapter: "codex-cli",
  evidenceCapability: "launch_configured",
} as const;

function profile(
  input: {
    source?: string;
    profileId?: string;
    candidateIndex?: number;
    candidateCount?: number;
    model?: string;
    modelRole?: "planning" | "implementation" | "verification";
    access?: "read-only" | "workspace-write";
    path?: string;
    content?: string;
  } = {},
): { artifact: WorkflowInstallAgentProfileArtifact; content: string } {
  const source = input.source ?? "catalog:cto";
  const profileId = input.profileId ?? "omniskills-startup-team-cto";
  const content =
    input.content ??
    `# omniskills-managed: team=startup-team source=${source}\nname = "${profileId}"\n`;
  return {
    content,
    artifact: {
      kind: "agent_profile",
      source,
      profileId,
      agent: "codex",
      status: "installed",
      path: input.path ?? join(homeDir, ".codex", "agents", `${profileId}.toml`),
      contentHash: hashAgentProfileContent(content),
      taskClass: "role",
      tier: source === "mattpocock:implement" ? "standard" : "deep",
      ...(input.modelRole ? { modelRole: input.modelRole } : {}),
      model: input.model ?? "gpt-5.6",
      effort: source === "mattpocock:implement" ? "medium" : "high",
      access: input.access ?? "read-only",
      instructions: `You are the ${source} agent for the startup-team Omniskills team.`,
      consultation: "request",
      limits: {
        retryPerCandidate: 1,
        reassignmentPerWorkItem: 1,
        consultationsPerAgent: 2,
      },
      candidateIndex: input.candidateIndex ?? 0,
      candidateCount: input.candidateCount ?? 1,
    },
  };
}

function installedWorkflow(
  profiles: WorkflowInstallAgentProfileArtifact[],
  options: { labeled?: boolean } = {},
): InstalledWorkflowBundle {
  const manifest = WorkflowBundleManifestSchema.parse({
    schemaVersion: "0.1",
    kind: "team",
    name: "startup-team",
    version: "0.3.0",
    description: "Dispatch planner fixture.",
    coordinator: "./skills/startup-goal",
    members: ["catalog:cto"],
    orchestration: {
      roles: {
        "./skills/startup-goal": {
          tier: "deep",
          ...(options.labeled ? { modelRole: "planning" } : {}),
          access: "read-only",
          consultation: "receive",
        },
        "catalog:cto": {
          tier: "deep",
          ...(options.labeled ? { modelRole: "planning" } : {}),
          access: "read-only",
          consultation: "request",
        },
        "mattpocock:implement": {
          tier: "standard",
          ...(options.labeled ? { modelRole: "implementation" } : {}),
          access: "workspace-write",
          consultation: "request",
        },
      },
    },
    skills: [
      { source: "./skills/startup-goal", entry: true },
      { source: "catalog:cto" },
      { source: "mattpocock:implement" },
    ],
    steps: [
      { id: "route", title: "Route", skill: "./skills/startup-goal" },
      {
        id: "implement",
        title: "Implement",
        skill: "mattpocock:implement",
        phase: "implementation",
      },
    ],
  });
  return {
    ...manifest,
    source: { kind: "local", path: "/tmp/startup-team" },
    installArtifacts: profiles,
  };
}

async function expectDispatchError(
  action: () => Promise<unknown>,
  code: OrchestrationDispatchError["code"],
): Promise<void> {
  try {
    await action();
    throw new Error(`Expected dispatch error: ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(OrchestrationDispatchError);
    expect((error as OrchestrationDispatchError).code).toBe(code);
  }
}

describe("orchestration dispatch planning", () => {
  test("detects repeated consultation evidence without conflating new evidence", () => {
    const prior = {
      type: "consultation_request" as const,
      trigger: "ambiguity" as const,
      current_task: "Review boundaries",
      evidence: ["Two public boundaries remain.", "Both pass the current contract."],
      decision_needed: "Choose one boundary.",
      recommendation: "Keep the adapter.",
    };
    expect(hasRepeatedConsultationEvidence(prior, { ...prior })).toBe(true);
    expect(
      hasRepeatedConsultationEvidence(prior, {
        ...prior,
        evidence: [...prior.evidence].reverse(),
      }),
    ).toBe(true);
    expect(
      hasRepeatedConsultationEvidence(prior, {
        ...prior,
        evidence: [...prior.evidence, "Two public boundaries remain."],
      }),
    ).toBe(true);
    expect(
      hasRepeatedConsultationEvidence(prior, {
        ...prior,
        evidence: ["The adapter now fails compatibility verification."],
      }),
    ).toBe(false);
  });

  test("plans labeled model-role evidence and fails closed for Claude", async () => {
    const labeledProfile = profile({ modelRole: "planning" });
    const contentByPath = new Map([[labeledProfile.artifact.path, labeledProfile.content]]);
    const workflow = installedWorkflow([labeledProfile.artifact], { labeled: true });

    const planSet = await planOrchestrationDispatch({
      workflow,
      role: "catalog:cto",
      runtime: "codex",
      task: "Review the service boundary.",
      cwd,
      homeDir,
      approveWorkspaceWrite: false,
      capabilities: { codex: codexCapability },
      readProfile: async (path) => contentByPath.get(path) ?? "",
    });

    expect(planSet.primary).toEqual(
      expect.objectContaining({
        role: "catalog:cto",
        modelRole: "planning",
        evidenceCapability: "launch_configured",
      }),
    );

    await expectDispatchError(
      () =>
        planOrchestrationDispatch({
          workflow,
          role: "catalog:cto",
          runtime: "claude",
          task: "Review the service boundary.",
          cwd,
          homeDir,
          approveWorkspaceWrite: false,
          capabilities: { claude: { ...codexCapability } },
          readProfile: async (path) => contentByPath.get(path) ?? "",
        }),
      "model_role_runtime_unsupported",
    );
  });

  test("plans ordered verified read-only candidates from installed artifacts", async () => {
    const primary = profile({ candidateCount: 2 });
    const fallback = profile({
      profileId: "omniskills-startup-team-cto-fallback-2",
      candidateIndex: 1,
      candidateCount: 2,
      model: "gpt-5.4",
    });
    const contentByPath = new Map([
      [primary.artifact.path, primary.content],
      [fallback.artifact.path, fallback.content],
    ]);

    const planSet = await planOrchestrationDispatch({
      workflow: installedWorkflow([fallback.artifact, primary.artifact]),
      role: "catalog:cto",
      runtime: "codex",
      task: "Review the service boundary.",
      cwd,
      homeDir,
      approveWorkspaceWrite: false,
      capabilities: { codex: codexCapability },
      readProfile: async (path) => contentByPath.get(path) ?? "",
    });

    expect(planSet.primary).toEqual(
      expect.objectContaining({
        profileId: "omniskills-startup-team-cto",
        tier: "deep",
        model: "gpt-5.6",
        effort: "high",
        access: "read-only",
        adapter: "codex-cli",
        evidenceCapability: "launch_configured",
      }),
    );
    expect(planSet.primary).not.toHaveProperty("evidenceRequired");
    expect(
      planSet.candidates.map(({ model, candidateIndex }) => ({ model, candidateIndex })),
    ).toEqual([
      { model: "gpt-5.6", candidateIndex: 0 },
      { model: "gpt-5.4", candidateIndex: 1 },
    ]);
    expect(
      createDispatchAttemptSchedule(planSet).map(({ model, candidateIndex }) => ({
        model,
        candidateIndex,
      })),
    ).toEqual([
      { model: "gpt-5.6", candidateIndex: 0 },
      { model: "gpt-5.6", candidateIndex: 0 },
      { model: "gpt-5.4", candidateIndex: 1 },
      { model: "gpt-5.4", candidateIndex: 1 },
    ]);
  });

  test("fails closed for invalid profile ownership, metadata, access, and runtime", async () => {
    const valid = profile();
    const base = {
      role: "catalog:cto",
      runtime: "codex" as const,
      task: "Review the service boundary.",
      cwd,
      homeDir,
      approveWorkspaceWrite: false,
      capabilities: { codex: codexCapability },
      readProfile: async () => valid.content,
    };

    await expectDispatchError(
      () => planOrchestrationDispatch({ ...base, workflow: installedWorkflow([]) }),
      "profile_not_found",
    );
    await expectDispatchError(
      () =>
        planOrchestrationDispatch({
          ...base,
          workflow: installedWorkflow([valid.artifact, { ...valid.artifact }]),
        }),
      "profile_ambiguous",
    );
    await expectDispatchError(
      () =>
        planOrchestrationDispatch({
          ...base,
          workflow: installedWorkflow([
            { ...valid.artifact, path: "/tmp/outside/omniskills-startup-team-cto.toml" },
          ]),
        }),
      "profile_path_invalid",
    );
    await expectDispatchError(
      () =>
        planOrchestrationDispatch({
          ...base,
          workflow: installedWorkflow([valid.artifact]),
          readProfile: async () => `${valid.content}# user drift\n`,
        }),
      "profile_drifted",
    );
    await expectDispatchError(() => {
      const { instructions: _instructions, ...legacyArtifact } = valid.artifact;
      return planOrchestrationDispatch({
        ...base,
        workflow: installedWorkflow([legacyArtifact]),
      });
    }, "profile_missing_dispatch_metadata");
    await expectDispatchError(
      () =>
        planOrchestrationDispatch({
          ...base,
          workflow: installedWorkflow([valid.artifact]),
          capabilities: { codex: { ...codexCapability, available: false } },
        }),
      "runtime_unavailable",
    );
  });

  test("requires explicit approval for workspace-write and bounds task input", async () => {
    const implementation = profile({
      source: "mattpocock:implement",
      profileId: "omniskills-startup-team-implement",
      access: "workspace-write",
    });
    const workflow = installedWorkflow([implementation.artifact]);
    const input = {
      workflow,
      role: "mattpocock:implement",
      runtime: "codex" as const,
      task: "Implement the approved slice.",
      cwd,
      homeDir,
      capabilities: { codex: codexCapability },
      readProfile: async () => implementation.content,
    };

    await expectDispatchError(
      () => planOrchestrationDispatch({ ...input, approveWorkspaceWrite: false }),
      "approval_required",
    );
    await expectDispatchError(
      () =>
        planOrchestrationDispatch({
          ...input,
          task: "x".repeat(MAX_DISPATCH_TASK_BYTES + 1),
          approveWorkspaceWrite: true,
        }),
      "task_too_large",
    );
    await expect(
      planOrchestrationDispatch({ ...input, approveWorkspaceWrite: true }),
    ).resolves.toEqual(
      expect.objectContaining({
        primary: expect.objectContaining({
          tier: "standard",
          access: "workspace-write",
          workspaceWriteApproved: true,
        }),
      }),
    );
  });
});
