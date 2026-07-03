import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
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

describe("package metadata", () => {
  test("builds and publishes a bundled CLI binary", async () => {
    const packageMetadata = await readPackageMetadata();

    expect(packageMetadata.name).toBe("getsuperpower");
    expect(packageMetadata.version).toBe("0.3.1");
    expect(packageMetadata.scripts?.build).toBe(
      "bun build --target=bun --outfile=dist/cli.js src/cli.ts",
    );
    expect(packageMetadata.scripts?.prepack).toBe("bun run build");
    expect(Object.keys(packageMetadata.bin ?? {})).toEqual(["getsuperpower"]);
    expect(packageMetadata.bin?.getsuperpower).toBe("dist/cli.js");
    expect(packageMetadata.files).toContain("dist");
    expect(packageMetadata.files).toContain("bundled-skills");
    expect(packageMetadata.files).toContain("examples");
  });
});
