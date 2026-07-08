import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { agents, commands, githubUrl, howItWorks, workflows } from "../landing/lib/landing-content";

const repoRoot = join(import.meta.dir, "..");

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function expectIncludes(markdown: string, value: string): void {
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

  expect(normalize(markdown)).toContain(normalize(value));
}

describe("landing content markdown mirrors", () => {
  test("keep the English agent-readable markdown aligned with landing content data", () => {
    const markdown = readRepoFile("docs/landing-content.md");

    expectIncludes(markdown, "Runtime source of truth: `landing/lib/landing-content.ts`");
    expectIncludes(markdown, githubUrl);

    for (const agent of agents) {
      expectIncludes(markdown, agent.id);
      expectIncludes(markdown, agent.name);
      if (agent.logoSrc) {
        expectIncludes(markdown, agent.logoSrc);
      }
    }

    for (const item of howItWorks) {
      expectIncludes(markdown, item.title);
      expectIncludes(markdown, item.body);
    }

    for (const command of commands) {
      expectIncludes(markdown, command.label);
      expectIncludes(markdown, command.command);
    }

    for (const workflow of workflows) {
      expectIncludes(markdown, workflow.slug);
      expectIncludes(markdown, workflow.name);
      expectIncludes(markdown, workflow.description);
      expectIncludes(markdown, workflow.entrySkill);
      expectIncludes(markdown, workflow.tag);
      expectIncludes(markdown, workflow.accent);
      expectIncludes(markdown, workflow.sourceUrl);
      expectIncludes(markdown, workflow.installCommand);

      for (const skill of workflow.skills) {
        expectIncludes(markdown, skill.name);
        expectIncludes(markdown, skill.description);
      }

      for (const step of workflow.diagramSteps) {
        expectIncludes(markdown, step.label);
        expectIncludes(markdown, step.skill);
        expectIncludes(markdown, step.description);
      }
    }
  });

  test("keep the Traditional Chinese landing markdown readable without translating identifiers", () => {
    const markdown = readRepoFile("docs/landing-content.zh-Hant.md");

    expectIncludes(markdown, "繁體中文 Markdown");
    expectIncludes(markdown, "`landing/lib/landing-content.ts`");
    expectIncludes(markdown, githubUrl);

    for (const agent of agents) {
      expectIncludes(markdown, agent.id);
      expectIncludes(markdown, agent.name);
      if (agent.logoSrc) {
        expectIncludes(markdown, agent.logoSrc);
      }
    }

    for (const command of commands) {
      expectIncludes(markdown, command.command);
    }

    for (const workflow of workflows) {
      expectIncludes(markdown, workflow.slug);
      expectIncludes(markdown, workflow.name);
      expectIncludes(markdown, workflow.entrySkill);
      expectIncludes(markdown, workflow.tag);
      expectIncludes(markdown, workflow.accent);
      expectIncludes(markdown, workflow.sourceUrl);
      expectIncludes(markdown, workflow.installCommand);

      for (const skill of workflow.skills) {
        expectIncludes(markdown, skill.name);
      }

      for (const step of workflow.diagramSteps) {
        expectIncludes(markdown, step.label);
        expectIncludes(markdown, step.skill);
      }
    }
  });
});
