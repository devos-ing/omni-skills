import { describe, expect, test } from "bun:test";
import {
  CodexModelCatalogError,
  createCodexModelCatalogProvider,
} from "../src/plugins/codex-model-catalog";

const catalogJson = JSON.stringify({
  models: [
    {
      slug: "gpt-5.5",
      display_name: "GPT-5.5",
      visibility: "list",
      priority: 0,
      supported_reasoning_levels: [
        { effort: "low", description: "Fast" },
        { effort: "medium", description: "Balanced" },
        { effort: "high", description: "Deep" },
      ],
    },
    {
      slug: "hidden-model",
      display_name: "Hidden",
      visibility: "hidden",
      priority: 1,
      supported_reasoning_levels: [{ effort: "high", description: "Deep" }],
    },
  ],
});

async function expectCatalogError(
  provider: ReturnType<typeof createCodexModelCatalogProvider>,
  code: CodexModelCatalogError["code"],
): Promise<void> {
  try {
    await provider("/tmp/project");
    throw new Error(`Expected catalog error: ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(CodexModelCatalogError);
    expect((error as CodexModelCatalogError).code).toBe(code);
  }
}

describe("Codex model catalog", () => {
  test("runs the documented command and returns only visible orchestration fields", async () => {
    const commands: unknown[] = [];
    const provider = createCodexModelCatalogProvider(async (command) => {
      commands.push(command);
      return { stdout: catalogJson, stderr: "", exitCode: 0 };
    });

    await expect(provider("/tmp/project")).resolves.toEqual([
      {
        slug: "gpt-5.5",
        visibility: "list",
        priority: 0,
        supportedReasoningEfforts: ["low", "medium", "high"],
      },
    ]);
    expect(commands).toEqual([
      { executable: "codex", args: ["debug", "models"], cwd: "/tmp/project" },
    ]);
  });

  test("reports a failed catalog command", async () => {
    await expectCatalogError(
      createCodexModelCatalogProvider(async () => ({
        stdout: "",
        stderr: "authentication failed",
        exitCode: 1,
      })),
      "command_failed",
    );
  });

  test("reports malformed catalog JSON", async () => {
    await expectCatalogError(
      createCodexModelCatalogProvider(async () => ({
        stdout: "not json",
        stderr: "",
        exitCode: 0,
      })),
      "malformed_catalog",
    );
  });

  test("reports a catalog without visible models", async () => {
    await expectCatalogError(
      createCodexModelCatalogProvider(async () => ({
        stdout: JSON.stringify({
          models: [
            {
              slug: "hidden-model",
              visibility: "hidden",
              priority: 0,
              supported_reasoning_levels: [{ effort: "high" }],
            },
          ],
        }),
        stderr: "",
        exitCode: 0,
      })),
      "empty_visible_catalog",
    );
  });
});
