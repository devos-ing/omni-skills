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
    expect(pkg.dependencies?.["boring-avatars"]).toBe("2.0.4");
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
    expect(content).toContain("Startup Goal");
    expect(content).toContain("CEO");
    expect(content).toContain("CTO");
    expect(content).toContain("Product Manager");
    expect(content).toContain("Engineering Manager");
    expect(content).toContain("Founding Engineer");
    expect(content).toContain("QA Lead");
    expect(content).toContain("avatarSeed");
    expect(content).toContain("npx getsuperpower@latest install startup-goal");
    expect(content).toContain("npx getsuperpower@latest install ceo");
    expect(content).toContain("npx getsuperpower@latest install cto");
    expect(content).toContain("npx getsuperpower@latest install product-manager");
    expect(content).toContain("npx getsuperpower@latest install engineering-manager");
    expect(content).toContain("npx getsuperpower@latest install founding-engineer");
    expect(content).toContain("npx getsuperpower@latest install qa-lead");
    expect(content).toContain("npx getsuperpower@latest deps startup-goal");
    expect(content).toContain("npx getsuperpower@latest lock examples/workflows/startup-goal");
    expect(content).toContain("npx getsuperpower@latest remove startup-goal");
    expect(content).not.toContain("npx getsuperpower@latest install startup-team");
    expect(content).toContain(
      "npx getsuperpower@latest loop status grilled-product-dev --latest --json",
    );
    expect(content).toContain("npx getsuperpower@latest validate");
    expect(content).not.toContain("npx getsuperpower@latest getsuperpower");
  });

  test("leads with the power-your-ability positioning", () => {
    const page = readLandingFile("components/landing-page.tsx");
    const content = readLandingFile("lib/landing-content.ts");

    expect(page).toContain("Power your ability.");
    expect(page).toContain("Install the workflow.");
    expect(page).toContain("many-skill bank");
    expect(page).toContain("3x your ability");
    expect(page).toContain("npx getsuperpower@latest install startup-goal");
    expect(page).toContain("Agent run demo");
    expect(page).toContain("See where startup-goal fits.");
    expect(page).not.toContain("How it works + Agent run demo");
    expect(page).not.toContain("One entry skill. Many specialist skills.");
    expect(page).not.toContain('href="#how-it-works"');
    expect(page).not.toContain('id="how-it-works"');
    expect(page).not.toContain("<FlowDiagram");
    expect(page).not.toContain("lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]");
    expect(page).not.toContain("xl:grid-cols-[22rem_minmax(0,1fr)]");
    expect(content).toContain("Install a many-skill bank");
    expect(content).toContain("Call one entry skill with a goal");
    expect(content).toContain("Compound specialist judgment");
    expect(content).toContain("3x your ability without manual skill juggling");
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
    expect(content).not.toContain("rank");
    expect(content).not.toContain("workflow telemetry");
    expect(content).not.toContain('"allTime"');
    expect(content).not.toContain('"trending"');
    expect(content).not.toContain('"hot"');
  });

  test("defines workflow detail metadata for route pages", () => {
    const content = readLandingFile("lib/landing-content.ts");

    expect(content).toContain("export interface WorkflowDiagramStep");
    expect(content).toContain("slug: string");
    expect(content).toContain("avatarSeed: string");
    expect(content).toContain("sourceUrl: string");
    expect(content).toContain("installCommand: string");
    expect(content).toContain("localSkillNames: string[]");
    expect(content).toContain("diagramSteps: WorkflowDiagramStep[]");
    expect(content).toContain("getLocalSkillSourceUrl");
    expect(content).toContain('localSkillNames: ["haaland"]');
    expect(content).toContain('slug: "startup-goal"');
    expect(content).toContain('slug: "founding-engineer"');
    expect(content).toContain('slug: "haaland"');
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/startup-goal`);
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/cto`);
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/haaland`);
    expect(content).toContain("npx getsuperpower@latest install startup-goal");
    expect(content).toContain("npx getsuperpower@latest install haaland");
    expect(content).toContain("Create one profile-icon meme concept");
    expect(content).not.toContain("Generate meme angles");
    expect(content).toContain('label: "Implementation"');
    expect(content).toContain('skill: "founding-engineer"');
  });

  test("renders workflow cards as route links with hash-seeded avatars", () => {
    const card = readLandingFile("components/workflow-card.tsx");
    const avatar = readLandingFile("components/workflow-avatar.tsx");

    expect(card).toContain('import Link from "next/link"');
    expect(card).toContain('import { WorkflowAvatar } from "./workflow-avatar"');
    expect(card).toContain(`href={\`/workflows/\${slug}\`}`);
    expect(card).toContain("avatarSeed");
    expect(card).toContain("<WorkflowAvatar");
    expect(card).toContain("View workflow");
    expect(card).toContain("skills.length");
    expect(avatar).toContain('import Avatar from "boring-avatars"');
    expect(avatar).toContain("name={seed}");
    expect(avatar).toContain('variant="beam"');
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

  test("explains current install behavior without reading generated workflow state", () => {
    const page = readLandingFile("components/landing-page.tsx");

    expect(page).toContain("Install by alias, public git URL, or local path");
    expect(page).toContain("validates the workflow");
    expect(page).toContain("manifest");
    expect(page).toContain("bootstraps missing external skills");
    expect(page).toContain("~/.getsuperpower/workflows/");
    expect(page).toContain("getsuperpower loop");
    expect(page).toContain("action-only");
    expect(page).not.toContain("browser executes live agent workflows");
    expect(page).not.toContain("generated .getsuperpower run state");
  });

  test("describes loop-enabled workflows as CLI-controlled and action-only", () => {
    const content = readLandingFile("lib/landing-content.ts");
    const page = readLandingFile("components/landing-page.tsx");

    expect(content).toContain(
      "npx getsuperpower@latest loop status grilled-product-dev --latest --json",
    );
    expect(content).toContain("resumable, action-only workflow state");
    expect(page).toContain("Pick a real startup situation");
    expect(content).not.toContain("executes tools");
    expect(content).not.toContain("runs live workflows in the browser");
  });

  test("renders static workflow detail routes from local workflow data", () => {
    const routePath = join(landingRoot, "app", "workflows", "[slug]", "page.tsx");

    expect(existsSync(routePath)).toBe(true);

    const route = readLandingFile("app/workflows/[slug]/page.tsx");

    expect(route).toContain('import Link from "next/link"');
    expect(route).toContain('import { notFound } from "next/navigation"');
    expect(route).toContain('from "../../../lib/landing-content"');
    expect(route).toContain("getLocalSkillSourceUrl");
    expect(route).toContain("export function generateStaticParams()");
    expect(route).toContain("workflows.map");
    expect(route).toContain("workflows.find");
    expect(route).toContain("notFound()");
    expect(route).toContain("workflow.installCommand");
    expect(route).toContain("WorkflowAvatar");
    expect(route).toContain("workflow.avatarSeed");
    expect(route).toContain('href="/#workflows"');
    expect(route).toContain("diagramSteps.map");
    expect(route).toContain("View source on GitHub");
    expect(route).toContain("entrySkillSourceUrl");
    expect(route).toContain("skillSourceUrl");
    expect(route).toContain("ExternalLink");
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

  test("makes every visible landing command click-to-copy", () => {
    const landingPage = readLandingFile("components/landing-page.tsx");
    const terminal = readLandingFile("components/terminal-block.tsx");
    const copyable = readLandingFile("components/copyable-install-command.tsx");

    expect(landingPage).toContain("const heroInstallCommand =");
    expect(landingPage).toContain("copyText={heroInstallCommand}");
    expect(landingPage).toContain('copyLabel="Copy startup-goal install command"');
    expect(landingPage).toContain("copiedCommandIndex");
    expect(landingPage).toContain("navigator.clipboard.writeText(command.command)");
    expect(landingPage).toContain("aria-label={`Copy command:");
    expect(landingPage).toContain("command.command}`}");
    expect(landingPage).toContain('{copiedCommandIndex === index ? "Copied" : "Copy"}');

    expect(terminal).toContain("copyLabel?: string");
    expect(terminal).toContain("aria-label={copyLabel ?? `Copy command:");
    expect(terminal).toContain("copyText}`}");
    expect(terminal).toContain("cursor-copy");

    expect(copyable).toContain("aria-label={`Copy install command:");
    expect(copyable).toContain("command}`}");
    expect(copyable).toContain("cursor-copy");
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
    expect(demo).toContain("const WORKFLOW_CASES: WorkflowCase[]");
    expect(demo).toContain("Idea to v1");
    expect(demo).toContain("Pivot or focus");
    expect(demo).toContain("Customer request");
    expect(demo).toContain("Case categories");
    expect(demo).toContain('className="space-y-3"');
    expect(demo).toContain("Processing");
    expect(demo).toContain("Case");
    expect(demo).toContain("Intake");
    expect(demo).toContain("Approval");
    expect(demo).toContain("Routing");
    expect(demo).toContain("Handoff");
    expect(demo).toContain("Route Goal");
    expect(demo).toContain("Strategy");
    expect(demo).toContain("Product Scope");
    expect(demo).toContain("Architecture");
    expect(demo).toContain("Delivery");
    expect(demo).toContain("Implementation");
    expect(demo).toContain("QA Review");
    expect(page).toContain("Agent run demo");
    expect(page).toContain("See where startup-goal fits.");
    expect(page).toContain("Pick a real startup situation");
    expect(demo).toContain(
      "/startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks",
    );
    expect(demo).toContain(
      "/startup-goal activation is weak; should we rebuild onboarding, narrow ICP, or add concierge setup?",
    );
    expect(demo).toContain(
      "/startup-goal customers keep asking for team seats; turn that into a safe release plan",
    );
    expect(page).toContain(
      "/startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks",
    );
    expect(demo).toContain("Run calls");
    expect(demo).toContain("selectedCaseIndex");
    expect(demo).toContain("selectCase");
    expect(demo).toContain("selectedStepIndex");
    expect(demo).toContain("Selected skill");
    expect(demo).toContain("View skill source");
    expect(demo).toContain("aria-label={`View $" + "{step.skill} skill`}");
    expect(demo).toContain("aria-pressed={isSelected}");
    expect(demo).toContain('aria-controls="selected-skill-preview"');
    expect(demo).toContain("owner: {selectedStep.owner}");
    expect(demo).toContain("const selectedStepStatus = getStepStatus");
    expect(demo).toContain("status: {selectedStepStatus}");
    expect(demo).toContain(
      "https://github.com/0xroylee/getsuperpower/blob/main/examples/workflows/startup-goal/skills",
    );
    expect(demo).not.toContain("Role calls");
    expect(demo).toContain("Combined answer");
    expect(demo).toContain("h-[44rem]");
    expect(demo).toContain("lg:h-[34rem]");
    expect(demo).toContain("grid h-full overflow-y-auto");
    expect(demo).toContain("lg:grid-cols-[18rem_minmax(0,1fr)]");
    expect(demo).not.toContain("lg:grid-cols-[16rem_minmax(0,1fr)_18rem]");
    expect(demo).toContain("min-h-0 flex-1 space-y-3 overflow-y-auto");
    expect(demo).toContain("font-mono text-xs leading-5");
    expect(demo).toContain("text-[11px]");
    expect(demo).toContain("const ACTIVE_ACCENT");
    expect(demo).toContain("showChecklist: !complete");
    expect(demo).not.toContain("text-sky-200");
    expect(demo).not.toContain("text-amber-200");
    expect(demo).not.toContain("text-cyan-200");
    expect(demo).not.toContain("text-lime-200");
    expect(demo).not.toContain("text-emerald-200");
    expect(demo).not.toContain("text-rose-200");
    expect(page).toContain("Landing simulation only");
    expect(page).toContain("No browser-side agent execution or fake telemetry");
    expect(demo).toContain("prefers-reduced-motion: reduce");
    expect(demo).toContain("motion-safe:animate-[agent-message_360ms_ease-out_both]");
    expect(page).toContain("[ok] CEO");
    expect(page).toContain("[ok] QA");
    expect(demo).not.toContain("$openspec-delivery");
    expect(demo).not.toContain("installCount");
    expect(demo).not.toContain("displayMetrics");
    expect(demo).toContain("setCompletedSteps");
    expect(demo).toContain("scrollRef.current?.scrollTo");
    expect(demo).toContain("Replay");
    expect(demo).toContain("setTimeout");
    expect(demo).toContain("clearTimeout");

    const demoIndex = page.indexOf("<WorkflowRunDemo");
    const workflowsIndex = page.indexOf('id="workflows"');

    expect(page).toContain("import { WorkflowRunDemo }");
    expect(page).not.toContain("import { FlowDiagram }");
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
