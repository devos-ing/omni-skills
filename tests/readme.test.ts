import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("README language mirrors", () => {
  test("keeps the English README product-copy first", () => {
    const readme = readRepoFile("README.md");
    const imageIndex = readme.indexOf("<img");
    const introIndex = readme.indexOf("A **GetSuperpower** is an all-in-one workflow skill.");

    expect(readme.startsWith("# GetSuperpower")).toBe(true);
    expect(readme).toContain("[繁體中文](README.zh-Hant.md)");
    expect(imageIndex).toBeGreaterThan(introIndex);
  });

  test("provides a Traditional Chinese README with commands and identifiers preserved", () => {
    const readme = readRepoFile("README.zh-Hant.md");

    expect(readme.startsWith("# GetSuperpower")).toBe(true);
    expect(readme).toContain("[English](README.md)");
    expect(readme).toContain("繁體中文");
    expect(readme).toContain("npx getsuperpower@latest install openspec-superpowers");
    expect(readme).toContain(
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'",
    );
    expect(readme).toContain("workflow.json");
    expect(readme).toContain("$creating-bundle-skills");
    expect(readme).toContain("examples/workflows/release-review");
    expect(readme).toContain("getsuperpower");
  });
});
