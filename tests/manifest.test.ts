import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDefaultManifest,
  loadManifest,
  ManifestSchema,
  writeManifest,
} from "../src/runtimes/ponytrail/manifest";

describe("manifest", () => {
  test("creates a default 4-bot requirement court with a non-voting Judge", () => {
    const manifest = createDefaultManifest();
    const parsed = ManifestSchema.parse(manifest);

    expect(parsed.kind).toBe("ai-work-runtime.ponytrail");
    expect(parsed.deliberation.decisionRule.voters).toBe(4);
    expect(parsed.deliberation.decisionRule.requiredApprovals).toBe(3);
    expect(parsed.deliberation.decisionRule.voterIds).toEqual([
      "product_manager_bot",
      "project_manager_bot",
      "engineer_bot",
      "testing_bot",
    ]);
    expect(parsed.bots.map((bot) => bot.id)).toEqual([
      "requirements_brainstorm_bot",
      "goal_draft_bot",
      "product_manager_bot",
      "project_manager_bot",
      "engineer_bot",
      "testing_bot",
      "requirement_judge_bot",
    ]);
    expect(parsed.models.map((model) => model.id)).toEqual([
      "requirements_model",
      "draft_model",
      "product_manager_model",
      "project_manager_model",
      "engineer_model",
      "testing_model",
      "judge_model",
    ]);
    expect(parsed.bots.map((bot) => [bot.id, bot.model])).toEqual([
      ["requirements_brainstorm_bot", "requirements_model"],
      ["goal_draft_bot", "draft_model"],
      ["product_manager_bot", "product_manager_model"],
      ["project_manager_bot", "project_manager_model"],
      ["engineer_bot", "engineer_model"],
      ["testing_bot", "testing_model"],
      ["requirement_judge_bot", "judge_model"],
    ]);
    expect(parsed.bots.find((bot) => bot.id === "requirement_judge_bot")?.type).toBe("judge_bot");
  });

  test("rejects bots that reference a missing model", () => {
    const manifest = createDefaultManifest();

    expect(() =>
      ManifestSchema.parse({
        ...manifest,
        bots: manifest.bots.map((bot) =>
          bot.id === "product_manager_bot" ? { ...bot, model: "missing_model" } : bot,
        ),
      }),
    ).toThrow();
  });

  test("writes and loads a manifest from disk", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-manifest-"));
    const manifestPath = join(rootDir, "manifest.json");

    try {
      const manifest = createDefaultManifest({ name: "Custom Court" });

      await writeManifest(manifestPath, manifest);
      const loaded = await loadManifest(manifestPath);

      expect(loaded.metadata.name).toBe("Custom Court");
      expect(loaded.runtime.workerAgents.map((agent) => agent.id)).toEqual(["codex", "claude"]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("loads legacy manifests that do not have a model registry yet", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-manifest-"));
    const manifestPath = join(rootDir, "manifest.json");

    try {
      const currentManifest = createDefaultManifest({ name: "Legacy Court" });
      const { models: _models, ...legacyManifest } = currentManifest;

      await writeFile(
        manifestPath,
        `${JSON.stringify(
          {
            ...legacyManifest,
            bots: legacyManifest.bots.map((bot) => ({ ...bot, model: "default_model" })),
          },
          null,
          2,
        )}\n`,
      );

      const loaded = await loadManifest(manifestPath);

      expect(loaded.metadata.name).toBe("Legacy Court");
      expect(loaded.models.map((model) => model.id)).toEqual([
        "requirements_model",
        "draft_model",
        "product_manager_model",
        "project_manager_model",
        "engineer_model",
        "testing_model",
        "judge_model",
      ]);
      expect(loaded.bots.map((bot) => [bot.id, bot.model])).toEqual([
        ["requirements_brainstorm_bot", "requirements_model"],
        ["goal_draft_bot", "draft_model"],
        ["product_manager_bot", "product_manager_model"],
        ["project_manager_bot", "project_manager_model"],
        ["engineer_bot", "engineer_model"],
        ["testing_bot", "testing_model"],
        ["requirement_judge_bot", "judge_model"],
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
