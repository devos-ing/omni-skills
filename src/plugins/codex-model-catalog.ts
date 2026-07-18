import { z } from "zod";
import type { SubprocessCommand, SubprocessResult } from "../process";
import { type CodexModelCapability, CodexReasoningEffortSchema } from "../runtimes/omniskill";

const RawCodexModelSchema = z
  .object({
    slug: z.string().min(1),
    visibility: z.string().min(1),
    priority: z.number().int(),
    supported_reasoning_levels: z
      .array(z.object({ effort: CodexReasoningEffortSchema }).passthrough())
      .min(1),
  })
  .passthrough();

const RawCodexCatalogSchema = z.object({ models: z.array(RawCodexModelSchema) }).passthrough();

export type CodexModelCatalogCommandRunner = (
  command: SubprocessCommand,
) => Promise<SubprocessResult>;

export type CodexModelCatalogProvider = (cwd: string) => Promise<CodexModelCapability[]>;

export type CodexModelCatalogErrorCode =
  | "command_failed"
  | "malformed_catalog"
  | "empty_visible_catalog";

export class CodexModelCatalogError extends Error {
  constructor(
    public readonly code: CodexModelCatalogErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CodexModelCatalogError";
  }
}

export function getVisibleCodexModels(
  catalog: readonly CodexModelCapability[],
): CodexModelCapability[] {
  return catalog.filter(({ visibility }) => visibility === "list");
}

export function createCodexModelCatalogProvider(
  runCommand: CodexModelCatalogCommandRunner,
): CodexModelCatalogProvider {
  return async (cwd) => {
    const result = await runCommand({
      executable: "codex",
      args: ["debug", "models"],
      cwd,
    });
    if (result.exitCode !== 0) {
      const diagnostic = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
      throw new CodexModelCatalogError(
        "command_failed",
        [
          "Codex model discovery failed. Update Codex or authenticate the intended identity.",
          diagnostic,
        ]
          .filter(Boolean)
          .join(" "),
      );
    }

    let parsed: z.infer<typeof RawCodexCatalogSchema>;
    try {
      parsed = RawCodexCatalogSchema.parse(JSON.parse(result.stdout) as unknown);
    } catch (error) {
      throw new CodexModelCatalogError(
        "malformed_catalog",
        `Codex returned an invalid model catalog. Update Codex and retry. ${String(error)}`,
      );
    }

    const catalog = getVisibleCodexModels(
      parsed.models.map((model) => ({
        slug: model.slug,
        visibility: model.visibility,
        priority: model.priority,
        supportedReasoningEfforts: model.supported_reasoning_levels.map(({ effort }) => effort),
      })),
    );
    if (catalog.length === 0) {
      throw new CodexModelCatalogError(
        "empty_visible_catalog",
        "Codex exposes no visible models. Update Codex or authenticate the intended identity.",
      );
    }
    return catalog;
  };
}
