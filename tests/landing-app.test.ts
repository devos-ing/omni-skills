import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { githubUrl, startupTeam } from "../landing/lib/landing-content";

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

  test("presents Omniskills workflow bundles and root-first commands", () => {
    const page = readLandingFile("app/page.tsx");
    const content = readLandingFile("lib/landing-content.ts");

    expect(page).toContain("LandingPage");
    expect(content).toContain("Omniskills");
    expect(content).toContain("Startup Team");
    expect(content).toContain("CEO");
    expect(content).toContain("CTO");
    expect(content).toContain("Product Manager");
    expect(content).toContain("Engineering Manager");
    expect(content).toContain("Founding Engineer");
    expect(content).toContain("QA Lead");
    expect(content).toContain("avatarSeed");
    expect(content).toContain("npx omniskill@latest install startup-team");
    expect(content).toContain("npx omniskill@latest install ceo");
    expect(content).toContain("npx omniskill@latest install cto");
    expect(content).toContain("npx omniskill@latest install product-manager");
    expect(content).toContain("npx omniskill@latest install engineering-manager");
    expect(content).toContain("npx omniskill@latest install founding-engineer");
    expect(content).toContain("npx omniskill@latest install qa-lead");
    expect(content).toContain("npx omniskill@latest deps startup-team");
    expect(content).toContain("npx omniskill@latest lock examples/teams/startup-team");
    expect(content).toContain("npx omniskill@latest remove startup-team");
    expect(content).not.toContain("npx omniskill@latest install startup-goal");
    expect(content).not.toContain("examples/workflows/startup-goal");
    expect(content).toContain(
      "npx omniskill@latest loop status grilled-product-dev --latest --json",
    );
    expect(content).toContain("npx omniskill@latest validate");
    expect(content).not.toContain("npx omniskill@latest omniskill");
  });

  test("leads with the power-your-ability positioning", () => {
    const page = readLandingFile("components/landing-page.tsx");
    const content = readLandingFile("lib/landing-content.ts");

    expect(page).toContain("Power your ability.");
    expect(page).toContain("Install the workflow.");
    expect(page).toContain("many-skill bank");
    expect(page).toContain("3x your ability");
    expect(page).toContain("npx omniskill@latest install startup-team");
    expect(page).toContain("Workflow in motion");
    expect(page).toContain("See startup-goal coordinate the work.");
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

  test("uses readable editorial tokens and a registry-first hierarchy", () => {
    const globals = readLandingFile("app/globals.css");
    const page = readLandingFile("components/landing-page.tsx");
    const card = readLandingFile("components/workflow-card.tsx");

    expect(globals).toContain("color-scheme: light");
    expect(globals).toContain("background: #f6f4ef");
    expect(globals).toContain("--body: #4f4b46");
    expect(globals).toContain("--muted: #716e68");
    expect(globals).toContain("--rule: #dedbd3");
    expect(globals).toContain("@media (hover: hover) and (pointer: fine)");
    expect(globals).toContain("@media (prefers-reduced-motion: reduce)");
    expect(page).toContain("bg-[#f6f4ef]");
    expect(page).toContain("text-[var(--body)]");
    expect(page).toContain("text-[var(--muted)]");
    expect(page).toContain("editorial-control");
    expect(page).not.toContain("bg-[#080808]");
    expect(card).toContain("editorial-control");
    expect(card).toContain("border-[var(--rule)]");
    expect(`${page}\n${card}`).not.toMatch(/text-\[#191817\]\/([2-5]\d)/);

    const teamIndex = page.indexOf("<FeaturedTeamSection");
    const hubIndex = page.indexOf("<SkillHub");
    const demoIndex = page.indexOf('id="workflow-example"');
    expect(teamIndex).toBeGreaterThan(-1);
    expect(hubIndex).toBeGreaterThan(teamIndex);
    expect(demoIndex).toBeLessThan(teamIndex);
  });

  test("shows the workflow example before the registry and autoplays on viewport entry", () => {
    const page = readLandingFile("components/landing-page.tsx");
    const demo = readLandingFile("components/workflow-run-demo.tsx");

    expect(page).toContain('id="workflow-example"');
    expect(demo).toContain("IntersectionObserver");
    expect(demo).toContain("hasEnteredViewport");
    expect(demo).not.toContain("Play example");
    expect(demo).not.toContain("hasStarted");
    expect(demo).not.toContain("TYPE_DELAY");
    expect(demo).not.toContain('behavior: prefersReducedMotion ? "auto" : "smooth"');
  });

  test("uses finite, accessible product-demo motion", () => {
    const reveal = readLandingFile("components/reveal.tsx");
    const page = readLandingFile("components/landing-page.tsx");
    const card = readLandingFile("components/workflow-card.tsx");
    const featuredTeam = readLandingFile("components/featured-team-section.tsx");
    const demo = readLandingFile("components/workflow-run-demo.tsx");
    const globals = readLandingFile("app/globals.css");
    const motionSources = `${reveal}\n${page}\n${card}\n${featuredTeam}\n${demo}\n${globals}`;

    expect(reveal).toContain("IntersectionObserver");
    expect(reveal).toContain("data-reveal");
    expect(reveal).toContain("--reveal-index");
    expect(page).toContain("motion-masthead");
    expect(featuredTeam).toContain("<Reveal");
    expect(page).not.toContain("motion-registry-row");
    expect(card).toContain("motion-avatar");
    expect(demo).toContain("motion-workbench");
    expect(demo).toContain("motion-active-role");
    expect(globals).toContain("animation-iteration-count: 1");
    expect(globals).toContain("@media (prefers-reduced-motion: reduce)");
    expect(motionSources).not.toMatch(/transition(?:-property)?:\s*all|transition-all/);
    expect(motionSources).not.toContain("scale(0)");
    expect(motionSources).not.toMatch(/animation[^;{]*(?:width|height|top|left|margin|padding)/);
  });

  test("documents the reference-derived registry design", () => {
    const design = readLandingFile("design.md");

    expect(design).toContain("https://www.context.store");
    expect(design).toContain("Omniskills Teams");
    expect(design).toContain("Skill Hub");
    expect(design).toContain("landing/components/featured-team-section.tsx");
    expect(design).toContain("landing/components/skill-hub.tsx");
    expect(design).toContain("landing/components/skill-row.tsx");
    expect(design).toContain("hide activity, rank, and install counts");
    expect(design).toContain("copyable");
    expect(design).toContain("landing/components/workflow-card.tsx");
    expect(design).not.toContain("Workflows Leaderboard");
    expect(design).not.toContain("All Time");
    expect(design).not.toContain("Trending");
    expect(design).not.toContain("Hot");
    expect(design).not.toContain("dependency-free mini bar/sparkline");
  });

  test("documents the featured team and Skill Hub in both content mirrors", () => {
    const design = readLandingFile("design.md");
    const english = readFileSync(join(repoRoot, "docs", "landing-content.md"), "utf8");
    const traditionalChinese = readFileSync(
      join(repoRoot, "docs", "landing-content.zh-Hant.md"),
      "utf8",
    );

    for (const document of [design, english, traditionalChinese]) {
      expect(document).toContain("Pick an Omniskills team");
      expect(document).toContain("Explore the Skill Hub");
      expect(document).toContain("Workflows");
      expect(document).toContain("Skills");
      expect(document).toContain("View skill source");
      expect(document).not.toContain("Heading: Pick an Omniskills workflow");
    }
    expect(english).toContain("npx omniskill@latest install startup-team");
    expect(traditionalChinese).toContain("npx omniskill@latest install startup-team");
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
    expect(content).toContain("getSkillSourceUrl");
    expect(content).toContain('localSkillNames: ["haaland"]');
    expect(content).toContain('slug: "startup-team"');
    expect(content).toContain(
      '{ name: "web-design", description: "Interface direction and motion quality" }',
    );
    expect(content).toContain('label: "Design"');
    expect(content).toContain('skill: "web-design"');
    expect(content).toContain('slug: "founding-engineer"');
    expect(content).toContain('slug: "haaland"');
    expect(content).toContain(`\${githubUrl}/tree/main/examples/teams/startup-team`);
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/cto`);
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/haaland`);
    expect(content).toContain("npx omniskill@latest install startup-team");
    expect(content).not.toContain("npx omniskill@latest install startup-goal");
    expect(content).toContain("npx omniskill@latest install haaland");
    expect(content).toContain("Create one profile-icon meme concept");
    expect(content).not.toContain("Generate meme angles");
    expect(content).toContain('label: "Implementation frame"');
    expect(content).toContain('skill: "founding-engineer"');
    expect(content).toContain("Execute the planned change with tests and review.");
  });

  test("mirrors the expanded startup-team roster and canonical member sources", () => {
    const content = readLandingFile("lib/landing-content.ts");
    const startupCardStart = content.indexOf('slug: "startup-team"');
    const nextCardStart = content.indexOf('slug: "ceo"', startupCardStart);
    const startupCard = content.slice(startupCardStart, nextCardStart);
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, "examples", "teams", "startup-team", "workflow.json"), "utf8"),
    ) as { members: string[] };
    const lock = JSON.parse(
      readFileSync(
        join(repoRoot, "examples", "teams", "startup-team", "workflow.lock.json"),
        "utf8",
      ),
    ) as { skills: Array<{ source: string; resolvedName: string; kind: "local" | "external" }> };
    const memberSkills = startupTeam.members.map(({ skill }) => skill);
    const expectedNames = lock.skills.map(({ source, resolvedName, kind }) =>
      kind === "external" ? source : resolvedName,
    );

    expect(startupCardStart).toBeGreaterThan(-1);
    expect(nextCardStart).toBeGreaterThan(startupCardStart);
    expect(manifest.members).toEqual(memberSkills.map((skill) => `catalog:${skill}`));
    expect(startupTeam.localSkillNames).toEqual(["startup-goal"]);
    for (const skill of memberSkills) {
      expect(startupTeam.skillSourceUrls?.[skill]).toBe(
        `${githubUrl}/blob/main/examples/workflows/${skill}/skills/${skill}/SKILL.md`,
      );
    }
    expect(expectedNames).toHaveLength(25);
    for (const name of expectedNames) {
      expect(startupCard).toContain(`name: "${name}"`);
    }
    for (const staleName of [
      "mattpocock:decision-mapping",
      "mattpocock:to-prd",
      "mattpocock:to-issues",
      "mattpocock:review",
    ]) {
      expect(startupCard).not.toContain(`{ name: "${staleName}"`);
    }
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

  test("features Startup Team before the searchable Skill Hub", () => {
    const page = readLandingFile("components/landing-page.tsx");
    const team = readLandingFile("components/featured-team-section.tsx");
    const hub = readLandingFile("components/skill-hub.tsx");
    const content = readLandingFile("lib/landing-content.ts");

    expect(page).toContain("<FeaturedTeamSection");
    expect(page).toContain("<SkillHub");
    expect(page).toContain("Explore teams & skills");
    expect(team).toContain('id="workflows"');
    expect(team).toContain("team.coordinator");
    expect(team).toContain("`$${team.coordinator.skill}`");
    expect(team).toContain("team.members.map");
    expect(team).not.toContain("tracking-[-0.025em]");
    expect(team).toContain("featuredTeamSectionContent");
    expect(content).toContain("export const featuredTeamSectionContent");
    expect(content).toContain("Pick an Omniskills team");
    expect(content).toContain("View team source");
    expect(team).not.toContain("Start with a coordinated team");
    expect(hub).toContain('id="skill-hub"');
    expect(content).toContain("Explore the Skill Hub");
    expect(page.indexOf("<FeaturedTeamSection")).toBeLessThan(page.indexOf("<SkillHub"));
  });

  test("implements keyboard-accessible Workflow and Skill tabs", () => {
    const hub = readLandingFile("components/skill-hub.tsx");
    const content = readLandingFile("lib/landing-content.ts");

    expect(hub).toContain('role="tablist"');
    expect(hub).toContain('role="tab"');
    expect(hub).toContain('role="tabpanel"');
    expect(hub).toContain("aria-selected");
    expect(hub).toContain("aria-controls");
    expect(hub).toContain('event.key === "ArrowRight"');
    expect(hub).toContain('event.key === "ArrowLeft"');
    expect(hub).toContain('event.key === "Home"');
    expect(hub).toContain('event.key === "End"');
    expect(hub).toContain('type="search"');
    expect(hub).toContain('aria-live="polite"');
    expect(content).toContain("Clear workflow search");
    expect(content).toContain("Clear skill search");
    expect(hub).toContain("font-semibold");
    expect(hub).toContain("active:bg-[#f0ede6]");
    expect(hub).not.toContain("tracking-[-0.025em]");
    expect(hub).toContain("skillHubSectionContent");
    expect(hub).toContain("function EmptyState");
    expect(content).toContain("export const skillHubSectionContent");
    expect(content).toContain("Explore the Skill Hub");
    expect(content).toContain("Clear workflow search");
    expect(content).toContain("Clear skill search");
    expect(hub).not.toContain("Browse independently installable workflows");
  });

  test("keeps skill results source-only and unanimated while filtering", () => {
    const page = readLandingFile("components/landing-page.tsx");
    const row = readLandingFile("components/skill-row.tsx");
    const hub = readLandingFile("components/skill-hub.tsx");

    expect(row).toContain("View skill source");
    expect(row).toContain("entry.usedBy");
    expect(row).toContain('target="_blank"');
    expect(row).toContain('rel="noreferrer"');
    expect(row).not.toContain("installCommand");
    expect(row).not.toContain("Copy");
    expect(hub).not.toContain("<Reveal");
    expect(hub).not.toContain("motion-registry-row");
    expect(hub).not.toContain("editorial-control");
    expect(readLandingFile("components/workflow-card.tsx")).toContain("View workflow");
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
    expect(page).toContain("~/.omniskills/workflows/");
    expect(page).toContain("omniskill loop");
    expect(page).toContain("action-only");
    expect(page).not.toContain("browser executes live agent workflows");
    expect(page).not.toContain("generated .omniskills run state");
  });

  test("describes loop-enabled workflows as CLI-controlled and action-only", () => {
    const content = readLandingFile("lib/landing-content.ts");
    const page = readLandingFile("components/landing-page.tsx");

    expect(content).toContain(
      "npx omniskill@latest loop status grilled-product-dev --latest --json",
    );
    expect(content).toContain("resumable, action-only workflow state");
    expect(page).toContain("Watch a real startup situation");
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
    expect(route).toContain("getSkillSourceUrl");
    expect(route).toContain("export function generateStaticParams()");
    expect(route).toContain("catalogEntries.map");
    expect(route).toContain("catalogEntries.find");
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
    expect(landingPage).toContain('copyLabel="Copy startup-team install command"');
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

    expect(page).toContain("https://api.github.com/repos/devos-ing/omni-skills");
    expect(page).toContain("stargazers_count");
    expect(page).toContain("next: { revalidate:");
    expect(page).toContain("formatGithubStarsLabel");
    expect(page).toContain("githubStarsLabel");
    expect(page).toContain("<LandingPage githubStarsLabel={githubStarsLabel} />");

    expect(landingPage).toContain('githubStarsLabel = "Stars"');
    expect(landingPage).toContain("{githubStarsLabel}");
    expect(landingPage).toContain("aria-label={`Open GitHub repository,");
  });

  test("renders a parallel startup-goal chat with case and checkpoint rails", () => {
    const demo = readLandingFile("components/workflow-run-demo.tsx");
    const page = readLandingFile("components/landing-page.tsx");

    expect(demo).toContain("export function WorkflowRunDemo");
    expect(demo).toContain("const WORKFLOW_CASES");
    expect(demo).toContain("Idea to v1");
    expect(demo).toContain("Pivot or focus");
    expect(demo).toContain("Customer request");
    expect(demo).toContain(
      "/startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks",
    );
    expect(demo).toContain(
      "/startup-goal activation is weak; should we rebuild onboarding, narrow ICP, or add concierge setup?",
    );
    expect(demo).toContain(
      "/startup-goal customers keep asking for team seats; turn that into a safe release plan",
    );
    expect(demo).toContain("interface WorkflowCase");
    expect(demo).toContain("coordinator: SkillStep");
    expect(demo).toContain("roles: SkillStep[]");
    expect(demo).toContain("roles: readonly [SkillStep, ...SkillStep[]]");
    expect(demo).toContain("type RunPhase =");
    expect(demo).toContain('kind: "collecting"; returnedRoleCount: number');
    expect(demo).toContain("const renderedPhase = prefersReducedMotion ? COMPLETE_PHASE : phase");
    expect(demo).toContain("phase.returnedRoleCount >= roleCount");
    expect(demo).toContain("const CHECKPOINTS");
    expect(demo).toContain("Brief approval");
    expect(demo).toContain("Route agents");
    expect(demo).toContain("Collect outputs");
    expect(demo).toContain("Combined answer");
    expect(demo).toContain("CaseRail");
    expect(demo).toContain("ChatTranscript");
    expect(demo).toContain("CheckpointRail");
    expect(demo).toContain("started working");
    expect(demo).toContain("SkillSourceLink");
    expect(demo).toContain("getCheckpointStatus");
    expect(demo).toContain("getRoleStatus");
    expect(demo).toContain('aria-live="polite"');
    expect(demo).toContain("aria-pressed={isSelected}");
    expect(demo).toContain("examples/teams/startup-team/skills/startup-goal/SKILL.md");
    expect(demo).toMatch(
      /\$\{ROLE_WORKFLOW_SOURCE_ROOT\}\/\$\{skill\}\/skills\/\$\{skill\}\/SKILL\.md/,
    );
    expect(demo).not.toMatch(/examples\/teams\/startup-team\/skills\/\$\{skill\}\/SKILL\.md/);
    expect(demo).toContain('target="_blank"');
    expect(demo).toContain('rel="noreferrer"');
    expect(demo).toContain("lg:grid-cols-[13rem_minmax(0,1fr)_13rem]");
    expect(demo).toContain("sm:grid-cols-3");
    expect(demo).toContain('behavior: "auto"');
    expect(demo).toContain("IntersectionObserver");
    expect(demo).toContain("hasEnteredViewport");
    expect(demo).toContain("Replay");
    expect(demo).toContain("setTimeout");
    expect(demo).toContain("clearTimeout");
    expect(demo).not.toContain("Run calls");
    expect(demo).not.toContain("Selected skill");
    expect(demo).not.toContain("selectedStepIndex");
    expect(demo).not.toContain("const [coordinator, ...roles] = input.steps");
    expect(demo).not.toContain("completedSteps");
    expect(demo).not.toContain("processPoints");
    expect(demo).not.toContain("selected-skill-preview");
    expect(demo).not.toContain("$openspec-delivery");
    expect(demo).not.toContain("installCount");
    expect(demo).not.toContain("displayMetrics");

    expect(page).toContain("Workflow in motion");
    expect(page).toContain("See startup-goal coordinate the work.");
    expect(page).toContain("Watch a real startup situation");
    expect(page).toContain("[ok] CEO");
    expect(page).toContain("[ok] QA");

    const demoIndex = page.indexOf("<WorkflowRunDemo");
    const teamIndex = page.indexOf("<FeaturedTeamSection");

    expect(page).toContain("import { WorkflowRunDemo }");
    expect(page).not.toContain("import { FlowDiagram }");
    expect(page).not.toContain("workflowRun");
    expect(demoIndex).toBeGreaterThan(-1);
    expect(teamIndex).toBeGreaterThan(-1);
    expect(demoIndex).toBeLessThan(teamIndex);
  });

  test("documents supported agents without a hero chip row", () => {
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
    expect(page).toContain("Claude, Codex, Cursor, opencode, and GitHub Copilot");
    expect(page).not.toContain("WebkitMask");
  });

  test("keeps attribution with the landing source", () => {
    const attribution = readLandingFile("ATTRIBUTIONS.md");

    expect(attribution).toContain("Create Omniskill Workflows");
    expect(attribution).toContain("Figma");
  });
});
