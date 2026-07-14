import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const readmePath = join(repoRoot, "README.md");

function readReadme(): string {
  return readFileSync(readmePath, "utf8");
}

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("README source contract", () => {
  test("leads with startup superpower positioning", () => {
    const readme = readReadme();
    const firstScreen = readme.slice(0, 1800);

    expect(readme.trimStart().startsWith("# Omniskills")).toBe(true);
    expect(firstScreen).toContain("# Omniskills");
    expect(firstScreen).toContain("[繁體中文](README.zh-Hant.md)");
    expect(firstScreen).toContain("Power your ability.");
    expect(firstScreen).toContain("many-skill bank");
    expect(firstScreen).toContain("one entry skill");
    expect(firstScreen).toContain("3x your ability");
    expect(firstScreen).toContain("Startup Team");
    expect(firstScreen).toContain("CEO");
    expect(firstScreen).toContain("CTO");
    expect(firstScreen).toContain("Product Manager");
    expect(firstScreen).toContain("Engineering Manager");
    expect(firstScreen).toContain("Founding Engineer");
    expect(firstScreen).toContain("QA Lead");
    expect(firstScreen).not.toContain("assets/diagrams/omniskill-how-it-works.svg");
    expect(firstScreen).not.toContain("assets/diagrams/omniskill-install-sequence.svg");
  });

  test("documents startup-team and its startup-goal coordinator", () => {
    const readme = readReadme();
    const roleAliases = [
      "ceo",
      "cto",
      "product-manager",
      "engineering-manager",
      "founding-engineer",
      "qa-lead",
    ];

    for (const alias of roleAliases) {
      expect(readme).toContain(`npx omniskill@latest install ${alias}`);
    }

    expect(readme).toContain("npx omniskill@latest install startup-team");
    expect(readme).toContain(
      "$startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks",
    );
    expect(readme).toContain(
      "npx omniskill@latest install 'https://github.com/devos-ing/omni-skills.git#examples/teams/startup-team'",
    );
    expect(readme).toContain("examples/teams/startup-team");
    expect(readme).not.toContain("npx omniskill@latest install startup-goal");
    expect(readme).not.toContain("examples/workflows/startup-goal");
    expect(readme).not.toContain(
      "$startup-team help me launch this product from idea to shipped v1",
    );
    expect(readme).not.toContain(
      "$startup-goal help me launch this product from idea to shipped v1",
    );
  });

  test("documents action-only goal loops", () => {
    const readme = readReadme();

    expect(readme).toContain("resumable workflow state");
    expect(readme).toContain("action-only");
    expect(readme).toContain("next suggested action");
    expect(readme).toContain("until the goal is done");
    expect(readme).toContain("npx omniskill@latest loop start grilled-product-dev --json");
    expect(readme).toContain(
      "npx omniskill@latest loop status grilled-product-dev --latest --json",
    );
    expect(readme).toContain(
      "npx omniskill@latest loop advance grilled-product-dev --run <run-id> --json",
    );
    expect(readme).toContain("does not silently execute tools or shell commands");
    expect(readme).not.toMatch(
      /fully autonomous|uncontrolled shell|runs shell commands by itself/i,
    );
  });

  test("keeps authoritative repository guidance aligned with first-class teams", () => {
    const agents = readRepoFile("AGENTS.md");
    const architecture = readRepoFile("docs/architecture.md");

    expect(agents).toContain("examples/teams/startup-team");
    expect(agents).toContain('kind: "team"');
    expect(agents).toContain("`coordinator`");
    expect(agents).toContain("`members[]`");
    expect(agents).toContain("resolve to a child workflow");
    expect(agents).not.toContain("unique local declared members");
    expect(agents).not.toContain("examples/workflows/startup-goal");
    expect(agents).not.toContain("remove startup-goal --dry-run");

    expect(architecture).toContain('kind: "team"');
    expect(architecture).toContain("`coordinator`");
    expect(architecture).toContain("`members[]`");
    expect(architecture).toContain("resolve to a child workflow");
    expect(architecture).toContain("examples/teams/<name>");
    expect(architecture).toMatch(/startup-goal remains the\s+callable coordinator/);
    expect(architecture).toContain("The coordinator is one declared local entry skill.");
    expect(architecture).not.toContain("the coordinator must also be the callable entry skill");
  });

  test("records the clean-install amendment to the approved startup-team plan", () => {
    const design = readRepoFile("docs/superpowers/specs/2026-07-14-startup-team-design.md");
    const plan = readRepoFile("docs/superpowers/plans/2026-07-14-startup-team.md");

    for (const document of [design, plan]) {
      expect(document).toContain("Clean-install amendment");
      expect(document).toContain("mattpocock:implement");
      expect(document).toContain("clean home");
    }
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
    const imageSrc = "assets/omniskill-startup-role-registry.png";
    const imageTag = `<img src="${imageSrc}" alt="Omniskills startup role workflow registry" width="920" />`;
    const imageIndex = readme.indexOf(imageTag);
    const quickStartIndex = readme.indexOf("## Quick Start");

    expect(readme.trimStart().startsWith(imageTag)).toBe(false);
    expect(imageIndex).toBeGreaterThan(quickStartIndex);
    expect(existsSync(join(repoRoot, imageSrc))).toBe(true);
    expect(readme).not.toContain("assets/diagrams/omniskill-how-it-works.svg");
    expect(readme).not.toContain("assets/diagrams/omniskill-install-sequence.svg");
    expect(readme).not.toContain("startup-goal-workflow-editorial.svg");
    expect(readme).not.toContain("startup-goal-workflow-funny.svg");
    expect(readme).not.toContain("startup-goal-workflow-claude.svg");
  });

  test("provides a Traditional Chinese README with commands and identifiers preserved", () => {
    const readme = readRepoFile("README.zh-Hant.md");

    expect(readme.startsWith("# Omniskills")).toBe(true);
    expect(readme).toContain("[English](README.md)");
    expect(readme).toContain("繁體中文");
    expect(readme).toContain("Power your ability.");
    expect(readme).toContain("npx omniskill@latest install startup-team");
    expect(readme).toContain("npx omniskill@latest install ceo");
    expect(readme).toContain("npx omniskill@latest install qa-lead");
    expect(readme).toContain(
      "$startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks",
    );
    expect(readme).toContain("npx omniskill@latest loop start grilled-product-dev --json");
    expect(readme).toContain("workflow.json");
    expect(readme).toContain("$creating-bundle-skills");
    expect(readme).toContain("examples/teams/startup-team");
    expect(readme).not.toContain("npx omniskill@latest install startup-goal");
    expect(readme).toContain("omniskill");
  });
});
