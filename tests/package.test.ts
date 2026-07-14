import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

interface PackageMetadata {
  name?: string;
  version?: string;
  bin?: Record<string, string>;
  files?: string[];
  scripts?: Record<string, string>;
}

async function readPackageMetadata(): Promise<PackageMetadata> {
  return JSON.parse(await readFile(join(import.meta.dir, "..", "package.json"), "utf8"));
}

async function readProductionSources(
  dir: string,
): Promise<Array<{ path: string; content: string }>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return readProductionSources(path);
      }
      if (!entry.isFile() || !entry.name.endsWith(".ts")) {
        return [];
      }
      return [{ path, content: await readFile(path, "utf8") }];
    }),
  );

  return files.flat();
}

describe("package metadata", () => {
  test("builds and publishes a bundled CLI binary", async () => {
    const packageMetadata = await readPackageMetadata();

    expect(packageMetadata.name).toBe("omniskill");
    expect(packageMetadata.version).toBe("0.6.0");
    expect(packageMetadata.scripts?.build).toBe(
      "bun build --target=node --outfile=dist/cli.js src/cli.ts",
    );
    expect(packageMetadata.scripts?.prepack).toBe("bun run build");
    expect(packageMetadata.bin).toEqual({ omniskill: "dist/cli.js" });
    expect(packageMetadata.files).toContain("dist");
    expect(packageMetadata.files).toContain("bundled-skills");
    expect(packageMetadata.files).toContain("examples");
  });

  test("publishes a Node-compatible CLI for npx users without Bun", async () => {
    const cliSource = await readFile(join(import.meta.dir, "..", "src", "cli.ts"), "utf8");
    const omniskillSource = await readFile(
      join(import.meta.dir, "..", "src", "omniskill.ts"),
      "utf8",
    );
    const workflowBundleSource = await readFile(
      join(import.meta.dir, "..", "src", "runtimes", "omniskill", "workflow-bundles.ts"),
      "utf8",
    );

    expect(cliSource.startsWith("#!/usr/bin/env node\n")).toBe(true);
    expect(omniskillSource).not.toContain("Bun.");
    expect(workflowBundleSource).not.toContain("Bun.");
  });

  test("does not ship production CLI source that invokes Bun", async () => {
    const sources = await readProductionSources(join(import.meta.dir, "..", "src"));
    const forbiddenBunRuntimePatterns = [
      /^#!\/usr\/bin\/env bun\b/m,
      /\bBun\./,
      /(?:executable:\s*["']bun["']|\[\s*["']bun["']|spawn\(\s*["']bun["'])/,
      /["'`]bun\s+(?:run|test|build|x|scripts?)/,
      /\bbunx\b/,
    ];

    const violations = sources.flatMap((source) =>
      forbiddenBunRuntimePatterns
        .filter((pattern) => pattern.test(source.content))
        .map((pattern) => `${source.path}: ${pattern.source}`),
    );

    expect(violations).toEqual([]);
  });
});
