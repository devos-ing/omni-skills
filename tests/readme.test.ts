import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const readmePath = join(repoRoot, "README.md");

function readReadme(): string {
  return readFileSync(readmePath, "utf8");
}

describe("README source contract", () => {
  test("leads with startup superpower positioning", () => {
    const readme = readReadme();
    const firstScreen = readme.slice(0, 1800);

    expect(readme.trimStart().startsWith("# GetSuperpower")).toBe(true);
    expect(firstScreen).toContain("# GetSuperpower");
    expect(firstScreen).toContain("Power your ability.");
    expect(firstScreen).toContain("installable workflow skill trees");
    expect(firstScreen).toContain("one callable entry skill");
    expect(firstScreen).toContain("Startup Team");
    expect(firstScreen).toContain("CEO");
    expect(firstScreen).toContain("CTO");
    expect(firstScreen).toContain("Product Manager");
    expect(firstScreen).toContain("Engineering Manager");
    expect(firstScreen).toContain("Founding Engineer");
    expect(firstScreen).toContain("QA Lead");
    expect(firstScreen).not.toContain("assets/diagrams/getsuperpower-how-it-works.svg");
    expect(firstScreen).not.toContain("assets/diagrams/getsuperpower-install-sequence.svg");
  });

  test("documents startup-team and individual startup role commands", () => {
    const readme = readReadme();
    const roleAliases = [
      "startup-team",
      "ceo",
      "cto",
      "product-manager",
      "engineering-manager",
      "founding-engineer",
      "qa-lead",
    ];

    for (const alias of roleAliases) {
      expect(readme).toContain(`npx getsuperpower@latest install ${alias}`);
    }

    expect(readme).toContain("$startup-team help me launch this product from idea to shipped v1");
    expect(readme).toContain(
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/startup-team'",
    );
  });

  test("documents action-only goal loops", () => {
    const readme = readReadme();

    expect(readme).toContain("resumable workflow state");
    expect(readme).toContain("action-only");
    expect(readme).toContain("next suggested action");
    expect(readme).toContain("until the goal is done");
    expect(readme).toContain("npx getsuperpower@latest loop start grilled-product-dev --json");
    expect(readme).toContain(
      "npx getsuperpower@latest loop status grilled-product-dev --latest --json",
    );
    expect(readme).toContain(
      "npx getsuperpower@latest loop advance grilled-product-dev --run <run-id> --json",
    );
    expect(readme).toContain("does not silently execute tools or shell commands");
    expect(readme).not.toMatch(
      /fully autonomous|uncontrolled shell|runs shell commands by itself/i,
    );
  });

  test("names the built-in skill ecosystem", () => {
    const readme = readReadme();

    expect(readme).toContain("Matt Pocock skills");
    expect(readme).toContain("Superpowers skills");
    expect(readme).toContain("Ponytrail evidence");
    expect(readme).toContain("More workflow packs are coming");
  });

  test("uses the startup role registry image instead of old diagrams", () => {
    const readme = readReadme();
    const imageSrc = "assets/getsuperpower-startup-role-registry.png";
    const imageTag = `<img src="${imageSrc}" alt="GetSuperpower startup role workflow registry" width="920" />`;
    const imageIndex = readme.indexOf(imageTag);
    const quickStartIndex = readme.indexOf("## Quick Start");

    expect(readme.trimStart().startsWith(imageTag)).toBe(false);
    expect(imageIndex).toBeGreaterThan(quickStartIndex);
    expect(existsSync(join(repoRoot, imageSrc))).toBe(true);
    expect(readme).not.toContain("assets/diagrams/getsuperpower-how-it-works.svg");
    expect(readme).not.toContain("assets/diagrams/getsuperpower-install-sequence.svg");
  });
});
