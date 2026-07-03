import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const landingRoot = join(repoRoot, "landing");

function readLandingFile(path: string): string {
  return readFileSync(join(landingRoot, path), "utf8");
}

describe("landing app source contract", () => {
  test("is an isolated Next 16 app with Bun scripts", () => {
    const packagePath = join(landingRoot, "package.json");

    expect(existsSync(packagePath)).toBe(true);
    expect(existsSync(join(landingRoot, "env.d.ts"))).toBe(true);

    const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as {
      private?: boolean;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(pkg.private).toBe(true);
    expect(pkg.scripts?.dev).toBe("next dev");
    expect(pkg.scripts?.build).toBe("next build");
    expect(pkg.scripts?.typecheck).toBe("next typegen && tsc --noEmit");
    expect(pkg.dependencies?.next).toBe("16.2.0");
    expect(pkg.dependencies?.react).toBe("19.2.7");
    expect(pkg.dependencies?.["react-dom"]).toBe("19.2.7");
    expect(pkg.devDependencies?.tailwindcss).toBe("4.1.12");
    expect(pkg.devDependencies?.["@tailwindcss/postcss"]).toBe("4.1.12");

    const gitignore = readLandingFile(".gitignore");

    expect(gitignore).toContain("next-env.d.ts");
  });

  test("presents GetSuperpower workflow bundles and root-first commands", () => {
    const page = readLandingFile("app/page.tsx");
    const content = readLandingFile("lib/landing-content.ts");

    expect(page).toContain("LandingPage");
    expect(content).toContain("GetSuperpower");
    expect(content).toContain("OpenSpec Delivery");
    expect(content).toContain("Release Review");
    expect(content).toContain("Real Engineering");
    expect(content).toContain("Development Design Delivery");
    expect(content).toContain("npx getsuperpower@latest install");
    expect(content).toContain("npx getsuperpower@latest validate");
    expect(content).not.toContain("npx getsuperpower@latest getsuperpower");
  });

  test("defines workflow detail metadata for in-page diagrams", () => {
    const content = readLandingFile("lib/landing-content.ts");

    expect(content).toContain("export interface WorkflowDiagramStep");
    expect(content).toContain("slug: string");
    expect(content).toContain("sourceUrl: string");
    expect(content).toContain("diagramSteps: WorkflowDiagramStep[]");
    expect(content).toContain('slug: "openspec-delivery"');
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/openspec-superpowers`);
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/release-review`);
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/real-engineering`);
    expect(content).toContain(
      `\${githubUrl}/tree/main/examples/workflows/development-design-delivery`,
    );
    expect(content).toContain('label: "Proposal"');
    expect(content).toContain('skill: "opsx-handoff-review"');
  });

  test("renders workflow cards as actionable selectors", () => {
    const card = readLandingFile("components/workflow-card.tsx");

    expect(card).toContain("isSelected");
    expect(card).toContain("onViewWorkflow");
    expect(card).toContain('type="button"');
    expect(card).toContain("View workflow");
    expect(card).toContain("aria-pressed");
  });

  test("renders selected workflow details with GitHub source links", () => {
    const detail = readLandingFile("components/workflow-detail.tsx");
    const page = readLandingFile("components/landing-page.tsx");

    expect(detail).toContain("WorkflowDetail");
    expect(detail).toContain("diagramSteps.map");
    expect(detail).toContain("sourceUrl");
    expect(detail).toContain('target="_blank"');
    expect(detail).toContain('rel="noreferrer"');
    expect(page).toContain("selectedWorkflowSlug");
    expect(page).toContain("WorkflowDetail");
    expect(page).toContain("setSelectedWorkflowSlug");
  });

  test("renders an interactive simulated workflow run section", () => {
    const demo = readLandingFile("components/workflow-run-demo.tsx");
    const page = readLandingFile("components/landing-page.tsx");

    expect(demo).toContain("export function WorkflowRunDemo");
    expect(demo).toContain("const STEPS: SkillStep[]");
    expect(demo).toContain("OpenSpec Proposal");
    expect(demo).toContain("Design Brainstorm");
    expect(demo).toContain("Implementation Plan");
    expect(demo).toContain("TDD Build");
    expect(demo).toContain("Try it live");
    expect(demo).toContain("Watch the workflow run");
    expect(demo).toContain("> $openspec-delivery implement idempotency for /payments/charge");
    expect(demo).toContain("setCompletedSteps");
    expect(demo).toContain("scrollRef.current?.scrollTo");
    expect(demo).toContain("Replay");
    expect(demo).toContain("setTimeout");
    expect(demo).toContain("clearTimeout");

    const demoIndex = page.indexOf("<WorkflowRunDemo");
    const workflowsIndex = page.indexOf('id="workflows"');

    expect(page).toContain("import { WorkflowRunDemo }");
    expect(page).not.toContain("workflowRun");
    expect(demoIndex).toBeGreaterThan(-1);
    expect(workflowsIndex).toBeGreaterThan(-1);
    expect(demoIndex).toBeLessThan(workflowsIndex);
  });

  test("keeps supported agents ready for logo chips", () => {
    const page = readLandingFile("components/landing-page.tsx");
    const content = readLandingFile("lib/landing-content.ts");

    const logoAgents = [
      ["claude", "agent-logos/claude.svg"],
      ["codex", "agent-logos/openai.svg"],
      ["cursor", "agent-logos/cursor.svg"],
      ["github-copilot", "agent-logos/github-copilot.svg"],
    ] as const;

    for (const [agentId, logoPath] of logoAgents) {
      expect(content).toContain(`id: "${agentId}"`);
      expect(content).toContain(`logoSrc: "/${logoPath}"`);
      expect(existsSync(join(landingRoot, "public", logoPath))).toBe(true);
    }
    expect(content).toContain('name: "GitHub Copilot"');
    expect(page).toContain("WebkitMask");
    expect(page).toContain("aria-hidden");
  });

  test("keeps attribution with the landing source", () => {
    const attribution = readLandingFile("ATTRIBUTIONS.md");

    expect(attribution).toContain("Create GetSuperpower Workflows");
    expect(attribution).toContain("Figma");
  });
});
