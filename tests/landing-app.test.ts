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

  test("uses Vercel Geist Sans as the landing app font", () => {
    const layout = readLandingFile("app/layout.tsx");
    const globals = readLandingFile("app/globals.css");
    const design = readLandingFile("design.md");

    expect(layout).toContain('import { Geist } from "next/font/google"');
    expect(layout).toContain("const geistSans = Geist");
    expect(layout).toContain('variable: "--font-geist-sans"');
    expect(layout).toContain("className={geistSans.variable}");
    expect(globals).toContain('var(--font-geist-sans), "Geist Sans"');
    expect(design).toContain("Vercel Geist Sans");
  });

  test("documents the reference-derived registry design", () => {
    const design = readLandingFile("design.md");

    expect(design).toContain("/Users/roy/Downloads/Create GetSuperpower Workflows/");
    expect(design).toContain("Workflow Registry");
    expect(design).toContain("hide activity, rank, and install counts");
    expect(design).toContain("copyable");
    expect(design).toContain("landing/components/workflow-card.tsx");
    expect(design).not.toContain("Workflows Leaderboard");
    expect(design).not.toContain("All Time");
    expect(design).not.toContain("Trending");
    expect(design).not.toContain("Hot");
    expect(design).not.toContain("dependency-free mini bar/sparkline");
  });

  test("does not define placeholder workflow activity or install metrics", () => {
    const content = readLandingFile("lib/landing-content.ts");

    expect(content).not.toContain("export type WorkflowActivityMode");
    expect(content).not.toContain("export interface WorkflowDisplayMetrics");
    expect(content).not.toContain("displayMetrics");
    expect(content).not.toContain("sourceLabel");
    expect(content).not.toContain("installCount");
    expect(content).not.toContain("activity:");
    expect(content).not.toContain('"allTime"');
    expect(content).not.toContain('"trending"');
    expect(content).not.toContain('"hot"');
  });

  test("defines workflow detail metadata for route pages", () => {
    const content = readLandingFile("lib/landing-content.ts");

    expect(content).toContain("export interface WorkflowDiagramStep");
    expect(content).toContain("slug: string");
    expect(content).toContain("sourceUrl: string");
    expect(content).toContain("installCommand: string");
    expect(content).toContain("diagramSteps: WorkflowDiagramStep[]");
    expect(content).toContain('slug: "openspec-delivery"');
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/openspec-superpowers`);
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/release-review`);
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/real-engineering`);
    expect(content).toContain(
      `\${githubUrl}/tree/main/examples/workflows/development-design-delivery`,
    );
    expect(content).toContain(
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'",
    );
    expect(content).toContain('label: "Proposal"');
    expect(content).toContain('skill: "opsx-handoff-review"');
  });

  test("renders workflow cards as route links", () => {
    const card = readLandingFile("components/workflow-card.tsx");

    expect(card).toContain('import Link from "next/link"');
    expect(card).toContain(`href={\`/workflows/\${slug}\`}`);
    expect(card).toContain("View workflow");
    expect(card).toContain("skills.length");
    expect(card).not.toContain("activityValues");
    expect(card).not.toContain("installCount");
    expect(card).not.toContain("sourceLabel");
    expect(card).not.toContain("Local activity signal");
    expect(card).not.toContain("Download");
    expect(card).not.toContain("recharts");
    expect(card).not.toContain("AreaChart");
    expect(card).not.toContain("isSelected");
    expect(card).not.toContain("onViewWorkflow");
    expect(card).not.toContain('type="button"');
    expect(card).not.toContain("aria-pressed");
  });

  test("keeps workflow browsing route-only on the landing page", () => {
    const page = readLandingFile("components/landing-page.tsx");

    expect(page).toContain("<WorkflowCard");
    expect(page).toContain("Workflow Registry");
    expect(page).toContain("filteredWorkflows.map");
    expect(page).toContain(
      '<span className="text-xs uppercase tracking-[0.18em] text-white/25">Workflow</span>',
    );
    expect(page).toContain("Detail");
    expect(page).not.toContain("type WorkflowActivityMode");
    expect(page).not.toContain("Workflows Leaderboard");
    expect(page).not.toContain("All Time");
    expect(page).not.toContain("Trending");
    expect(page).not.toContain("Hot");
    expect(page).not.toContain("activeActivityMode");
    expect(page).not.toContain("setActiveActivityMode");
    expect(page).not.toContain("displayMetrics.activity");
    expect(page).not.toContain("Installs");
    expect(page).not.toContain("Activity");
    expect(page).not.toContain("selectedWorkflowSlug");
    expect(page).not.toContain("selectedWorkflow");
    expect(page).not.toContain("setSelectedWorkflowSlug");
    expect(page).not.toContain("WorkflowDetail");
    expect(page).not.toContain("AreaChart");
    expect(page).not.toContain("recharts");
  });

  test("renders static workflow detail routes from local workflow data", () => {
    const routePath = join(landingRoot, "app", "workflows", "[slug]", "page.tsx");

    expect(existsSync(routePath)).toBe(true);

    const route = readLandingFile("app/workflows/[slug]/page.tsx");

    expect(route).toContain('import Link from "next/link"');
    expect(route).toContain('import { notFound } from "next/navigation"');
    expect(route).toContain('from "../../../lib/landing-content"');
    expect(route).toContain("export function generateStaticParams()");
    expect(route).toContain("workflows.map");
    expect(route).toContain("workflows.find");
    expect(route).toContain("notFound()");
    expect(route).toContain("workflow.installCommand");
    expect(route).toContain('href="/#workflows"');
    expect(route).toContain("diagramSteps.map");
    expect(route).toContain("View source on GitHub");
    expect(route).toContain('target="_blank"');
    expect(route).toContain('rel="noreferrer"');
  });

  test("renders copyable install commands on workflow detail pages", () => {
    const route = readLandingFile("app/workflows/[slug]/page.tsx");

    expect(existsSync(join(landingRoot, "components", "copyable-install-command.tsx"))).toBe(true);
    expect(route).toContain("CopyableInstallCommand");
    expect(route).toContain("workflow.installCommand");

    const copyable = readLandingFile("components/copyable-install-command.tsx");

    expect(copyable).toContain('"use client"');
    expect(copyable).toContain("navigator.clipboard.writeText(command)");
    expect(copyable).toContain("Copied");
    expect(copyable).toContain("Copy");
    expect(copyable).toContain("install command");
  });

  test("renders GitHub stars in the landing header from cached server metadata", () => {
    const page = readLandingFile("app/page.tsx");
    const landingPage = readLandingFile("components/landing-page.tsx");

    expect(page).toContain("https://api.github.com/repos/0xroylee/getsuperpower");
    expect(page).toContain("stargazers_count");
    expect(page).toContain("next: { revalidate:");
    expect(page).toContain("formatGithubStarsLabel");
    expect(page).toContain("githubStarsLabel");
    expect(page).toContain("<LandingPage githubStarsLabel={githubStarsLabel} />");

    expect(landingPage).toContain('githubStarsLabel = "Stars"');
    expect(landingPage).toContain("{githubStarsLabel}");
    expect(landingPage).toContain("aria-label={`Open GitHub repository,");
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
