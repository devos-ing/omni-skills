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
    expect(pkg.scripts?.build).toBe("next build --webpack");
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

  test("defines the audience-first Startup Team landing contract", () => {
    const page = readLandingFile("components/landing-page.tsx");
    const content = readLandingFile("lib/landing-content.ts");

    for (const label of ["Solo Founders", "Developers", "Startup Teams"]) {
      expect(content).toContain(`label: "${label}"`);
    }
    for (const agent of [
      "Cursor",
      "Codex",
      "Claude",
      "OpenCode",
      "Hermes",
      "OpenClaw",
      "GitHub Copilot",
    ]) {
      expect(content).toContain(`name: "${agent}"`);
    }
    for (const capability of [
      "Strategy & validation",
      "Product requirements",
      "Interface design",
      "Architecture & implementation",
      "QA & release verification",
      "Approval gates & handoffs",
    ]) {
      expect(content).toContain(`title: "${capability}"`);
    }
    expect(content).toContain('headline: "Build with a startup team of agents."');
    expect(content).toContain('label: "Simulated run"');
    expect(page).toContain("<FeaturedTeamSection");
    expect(page).toContain("<SkillHub");
    expect(page).not.toContain("install count");
    expect(page).not.toContain("active users");
  });

  test("loads Vercel Geist Sans and Mono from the official package", () => {
    const layout = readLandingFile("app/layout.tsx");
    const globals = readLandingFile("app/globals.css");
    const design = readLandingFile("design.md");
    const pkg = JSON.parse(readLandingFile("package.json")) as {
      dependencies?: Record<string, string>;
    };

    expect(layout).not.toContain("next/font/google");
    expect(layout).toContain('import { GeistSans } from "geist/font/sans"');
    expect(layout).toContain('import { GeistMono } from "geist/font/mono"');
    expect(layout).toContain("GeistSans.variable");
    expect(layout).toContain("GeistMono.variable");
    expect(globals).toContain("font-family: var(--font-geist-sans)");
    expect(globals).toContain("font-family: var(--font-geist-mono)");
    expect(pkg.dependencies?.geist).toBeDefined();
    expect(design).toContain("official Vercel `geist` package");
  });

  test("uses the AgentKey-derived cool technical system and fixed product hierarchy", () => {
    const globals = readLandingFile("app/globals.css");
    const page = readLandingFile("components/landing-page.tsx");
    const card = readLandingFile("components/workflow-card.tsx");

    expect(globals).toContain("color-scheme: light");
    expect(globals).toContain("background: #fafafa");
    expect(globals).toContain("--surface: #ffffff");
    expect(globals).toContain("--ink");
    expect(globals).toContain("--body: #6b7280");
    expect(globals).toContain("--muted: #9ca3af");
    expect(globals).toContain("--rule: #e6e6e6");
    expect(globals).toContain("--accent: #207480");
    expect(globals).toContain("--dark: #26202f");
    expect(globals).not.toContain("--accent: #e64b2e");
    expect(globals).toContain(".editorial-heading");
    expect(globals).toContain(".agent-logo-grid");
    expect(globals).toContain(".audience-product-grid");
    expect(globals).toContain(".capability-grid");
    expect(globals).toContain(".why-layout");
    expect(globals).toContain(".site-rail");
    expect(globals).toContain("overflow-x: clip");
    expect(globals).toContain("@media (hover: hover) and (pointer: fine)");
    expect(globals).toContain("@media (prefers-reduced-motion: reduce)");
    expect(page).toContain("text-[var(--body)]");
    expect(page).toContain("text-[var(--muted)]");
    expect(page).toContain("editorial-control");
    expect(page).not.toContain("bg-[#080808]");
    expect(card).toContain("editorial-control");
    expect(card).toContain("border-[var(--rule)]");
    expect(`${page}\n${card}`).not.toMatch(/text-\[#191817\]\/([2-5]\d)/);

    const heroIndex = page.indexOf("<StartupTeamHero");
    const audienceIndex = page.indexOf("<AudienceShowcase");
    const agentsIndex = page.indexOf("<SupportedAgentStrip");
    const capabilityIndex = page.indexOf("<CapabilityGrid");
    const whyIndex = page.indexOf("<WhyOmniskills");
    const teamIndex = page.indexOf("<FeaturedTeamSection");
    const hubIndex = page.indexOf("<SkillHub");
    const stepsIndex = page.indexOf("<HowStartupTeamWorks");
    const faqIndex = page.indexOf("<LandingFaq");
    const finalIndex = page.indexOf("<FinalInstallCta");
    const indexes = [
      heroIndex,
      audienceIndex,
      agentsIndex,
      capabilityIndex,
      whyIndex,
      teamIndex,
      hubIndex,
      stepsIndex,
      faqIndex,
      finalIndex,
    ];
    expect(indexes.every((value) => value >= 0)).toBe(true);
    expect(
      indexes.every(
        (value, index) => index === 0 || (indexes[index - 1] ?? Number.NEGATIVE_INFINITY) < value,
      ),
    ).toBe(true);
  });

  test("shows the workflow example before the registry and autoplays on viewport entry", () => {
    const audience = readLandingFile("components/audience-showcase.tsx");
    const demo = readLandingFile("components/workflow-run-demo.tsx");

    expect(audience).toContain('id="showcase"');
    expect(audience).toContain("<WorkflowRunDemo");
    expect(demo).toContain("IntersectionObserver");
    expect(demo).toContain("hasEnteredViewport");
    expect(demo).not.toContain("Play example");
    expect(demo).not.toContain("hasStarted");
    expect(demo).not.toContain("TYPE_DELAY");
    expect(demo).not.toContain('behavior: prefersReducedMotion ? "auto" : "smooth"');
  });

  test("uses Shopify-style spacing and a credible assistant conversation", () => {
    const globals = readLandingFile("app/globals.css");
    const demo = readLandingFile("components/workflow-run-demo.tsx");

    expect(globals).toContain("--space-100: 4px");
    expect(globals).toContain("--space-400: 16px");
    expect(globals).toContain("--space-600: 24px");
    expect(globals).toContain("--space-800: 32px");
    expect(globals).toContain("--font-size-body: 14px");
    expect(globals).toContain("--font-size-caption: 12px");
    expect(globals).toContain(".chat-shell");
    expect(globals).toContain(".chat-message");
    expect(globals).toContain(".chat-tool-row");
    expect(globals).toContain(".chat-composer");
    expect(demo).toContain('aria-label="Simulated agent conversation"');
    expect(demo).toContain("chat-user-message");
    expect(demo).toContain("chat-assistant-message");
    expect(demo).toContain("chat-tool-row");
    expect(demo).toContain("chat-composer");
    expect(demo).toContain("Simulated conversation");
  });

  test("uses finite, accessible product-demo motion", () => {
    const reveal = readLandingFile("components/reveal.tsx");
    const page = readLandingFile("components/landing-page.tsx");
    const card = readLandingFile("components/workflow-card.tsx");
    const featuredTeam = readLandingFile("components/featured-team-section.tsx");
    const demo = readLandingFile("components/workflow-run-demo.tsx");
    const globals = readLandingFile("app/globals.css");
    const motionSources = `${reveal}\n${page}\n${card}\n${featuredTeam}\n${demo}\n${globals}`;

    expect(reveal).toContain("data-reveal");
    expect(reveal).toContain("--reveal-index");
    expect(reveal).not.toContain('useState<RevealState>("visible")');
    expect(page).toContain("<StartupTeamHero");
    expect(featuredTeam).toContain("<Reveal");
    expect(page).not.toContain("motion-registry-row");
    expect(card).toContain("motion-avatar");
    expect(demo).toContain("motion-workbench");
    expect(demo).toContain("orchestration-lane");
    expect(globals).toContain("animation-iteration-count: 1");
    expect(globals).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globals).not.toContain("capability-settle");
    expect(globals).toContain(".motion-workbench");
    expect(globals).toContain(".audience-product-grid");
    expect(motionSources).not.toMatch(/transition(?:-property)?:\s*all|transition-all/);
    expect(motionSources).not.toContain("transition: all");
    expect(motionSources).not.toContain("animation-iteration-count: infinite");
    expect(motionSources).not.toContain("scale(0)");
    expect(motionSources).not.toMatch(/animation[^;{]*(?:width|height|top|left|margin|padding)/);
  });

  test("documents the reference-derived registry design", () => {
    const design = readLandingFile("design.md");

    expect(design).toContain("https://agentkey.app/");
    expect(design).toContain("AgentKey-like");
    expect(design).toContain("Teams and Skill Hub");
    expect(design).toContain("Skill Hub");
    expect(design).toContain("Show fake users, stars, rankings, activity, install counts");
    expect(design).toContain("copy `npx omniskill@latest install startup-team`");
    expect(design).toContain("landing/components/landing-page.tsx");
    expect(design).not.toContain("Workflows Leaderboard");
    expect(design).not.toContain("All Time");
    expect(design).not.toContain("Trending");
    expect(design).not.toContain("Hot");
    expect(design).not.toContain("dependency-free mini bar/sparkline");
  });

  test("documents the three-team control tower in both content mirrors", () => {
    const design = readLandingFile("design.md");
    const english = readFileSync(join(repoRoot, "docs", "landing-content.md"), "utf8");
    const traditionalChinese = readFileSync(
      join(repoRoot, "docs", "landing-content.zh-Hant.md"),
      "utf8",
    );

    for (const document of [english, traditionalChinese]) {
      for (const value of [
        "Orchestration for Codex",
        "One goal. A team of agents. One verified result.",
        "Example run · hardcoded preview",
        "Build a landing page",
        "Research a stock",
        "Research the market",
        "$startup-goal",
        "$finance-research",
        "$market-research",
        "npx omniskill@latest install startup-team",
        "bun run dev -- install examples/teams/finance-team",
        "bun run dev -- install examples/teams/market-team",
      ]) {
        expect(document).toContain(value);
      }
      expect(document).toContain("Pick the team for the goal");
      expect(document).toContain("Explore the Skill Hub");
      expect(document).toContain("Workflows");
      expect(document).toContain("Skills");
      expect(document).toContain("View skill source");
      expect(document).not.toContain("Heading: Pick an Omniskills workflow");
    }
    expect(english).toContain("not published through `omniskill@latest` yet");
    expect(traditionalChinese).toContain("尚未透過 `omniskill@latest` 發布");
    for (const value of [
      "Startup Team leads",
      "simulated agent window",
      "Mobile",
      "reduced-motion",
    ]) {
      expect(design).toContain(value);
    }
  });

  test("describes the evidence-backed startup milestone lifecycle", () => {
    const content = readLandingFile("lib/landing-content.ts");

    expect(content).toContain("feature milestone");
    expect(content).toContain("Evidence Ledger");
    expect(content).toContain("User Outcome Replay");
    for (const label of [
      "Prepare",
      "Plan",
      "Plan approval",
      "Implement",
      "Rework if needed",
      "Verify",
      "User Outcome Replay",
      "Feature acceptance",
    ]) {
      expect(content).toContain(`label: "${label}"`);
    }
  });

  test("presents the latest startup lifecycle without public dispatch claims", () => {
    const content = readLandingFile("lib/landing-content.ts");
    const demo = readLandingFile("components/workflow-run-demo.tsx");

    expect(content).toContain('label: "Rework if needed"');
    expect(content).toContain("npx omniskill@latest setup-model-routing");
    expect(content).toContain(
      "https://github.com/mattpocock/skills/blob/d574778f94cf620fcc8ce741584093bc650a61d3/skills/engineering/implement/SKILL.md",
    );
    expect(content).toContain("Prepare selected specialist handoffs");
    expect(content).not.toContain("Dispatch selected analysts");

    expect(demo).toContain('dispatch: "Starting selected roles"');
    expect(demo).toContain("The coordinator can launch the selected roles.");
    expect(demo).not.toContain("The coordinator can dispatch the selected skills.");
    expect(demo).toContain("Simulated conversation");
  });

  test("renders precise Startup Team safety and CLI compatibility guidance", () => {
    const content = readLandingFile("lib/landing-content.ts");
    const faq = readLandingFile("components/landing-faq.tsx");

    expect(content).toContain("checked-in schema 0.2 lock");
    expect(content).toContain("exact-commit external locators");
    expect(content).toContain("same checkout");
    expect(content).toContain("recorded ownership");
    expect(content).toContain("mixed ownership fails closed");
    expect(content).toContain("Finance Team and Market Team remain lockless local previews");
    expect(content).toContain("Use install as the public install command.");
    expect(content).toContain("bundle and workflow remain compatibility aliases.");
    expect(faq).toContain("{item.answer}");
  });

  test("does not define placeholder workflow activity or install metrics", () => {
    const content = readLandingFile("lib/landing-content.ts");

    expect(content).not.toContain("export type WorkflowActivityMode");
    expect(content).not.toContain("export interface WorkflowDisplayMetrics");
    expect(content).not.toContain("displayMetrics");
    expect(content).not.toContain("sourceLabel");
    expect(content).not.toContain("installCount");
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
    expect(content).toContain("export interface WorkflowUsageExample");
    expect(content).toContain("usageExample?: WorkflowUsageExample");
    expect(content).toContain("getSkillSourceUrl");
    expect(content).toContain('localSkillNames: ["haaland"]');
    expect(content).toContain('slug: "startup-team"');
    expect(content).toContain(
      '{ name: "web-design", description: "Interface direction and motion quality" }',
    );
    expect(content).toContain('label: "Plan approval"');
    expect(content).toContain('label: "User Outcome Replay"');
    expect(content).toContain('slug: "founding-engineer"');
    expect(content).toContain('slug: "haaland"');
    expect(content).toContain('slug: "codex-input-preview"');
    expect(content).toContain(`\${githubUrl}/tree/main/examples/teams/startup-team`);
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/cto`);
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/haaland`);
    expect(content).toContain("npx omniskill@latest install startup-team");
    expect(content).not.toContain("npx omniskill@latest install startup-goal");
    expect(content).toContain("npx omniskill@latest install haaland");
    expect(content).toContain("npx omniskill@latest install codex-input-preview");
    expect(content).toContain("/examples/codex-input-preview.png");
    expect(content).toContain("$codex-input-preview Draw “Help me announce");
    expect(content).toContain("Simulated Codex composer preview — not a live Codex session.");
    expect(content).toContain("Create one profile-icon meme concept");
    expect(content).not.toContain("Generate meme angles");
    expect(content).toContain('label: "Feature acceptance"');
    expect(content).toContain("Execute only the approved milestone slice.");
  });

  test("mirrors the expanded startup-team roster and same-checkout member sources", () => {
    const content = readLandingFile("lib/landing-content.ts");
    const startupCardStart = content.indexOf('slug: "startup-team"');
    const nextCardStart = content.indexOf('slug: "finance-team"', startupCardStart);
    const startupCard = content.slice(startupCardStart, nextCardStart);
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, "examples", "teams", "startup-team", "workflow.json"), "utf8"),
    ) as { members: string[]; skills: Array<{ source: string }> };
    const memberSkills = startupTeam.members.map(({ skill }) => skill);
    const expectedNames = startupTeam.skills.map(({ name }) => name);

    expect(startupCardStart).toBeGreaterThan(-1);
    expect(nextCardStart).toBeGreaterThan(startupCardStart);
    expect(manifest.members).toEqual(memberSkills.map((skill) => `../../workflows/${skill}`));
    expect(startupTeam.localSkillNames).toEqual(["startup-goal"]);
    for (const skill of memberSkills) {
      expect(startupTeam.skillSourceUrls?.[skill]).toBe(
        `${githubUrl}/blob/main/examples/workflows/${skill}/skills/${skill}/SKILL.md`,
      );
    }
    expect(manifest.members).not.toContain(
      "../../workflows/setup-model-routing/skills/setup-model-routing",
    );
    expect(manifest.skills.map(({ source }) => source)).toContain(
      "../../workflows/setup-model-routing/skills/setup-model-routing",
    );
    expect(startupTeam.skillSourceUrls?.["setup-model-routing"]).toBe(
      `${githubUrl}/blob/main/examples/workflows/setup-model-routing/skills/setup-model-routing/SKILL.md`,
    );
    expect(expectedNames).toHaveLength(manifest.skills.length);
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

  test("features all three teams before the searchable Skill Hub", () => {
    const page = readLandingFile("components/landing-page.tsx");
    const team = readLandingFile("components/featured-team-section.tsx");
    const hub = readLandingFile("components/skill-hub.tsx");
    const content = readLandingFile("lib/landing-content.ts");

    expect(page).toContain("<FeaturedTeamSection");
    expect(page).toContain("<SkillHub");
    expect(page).toContain("<FeaturedTeamSection teams={teams}");
    expect(team).toContain('id="workflows"');
    expect(team).toContain("const [startupTeam, ...companionTeams] = teams");
    expect(team).toContain("startupTeam.coordinator");
    expect(team).toContain("`$${startupTeam.coordinator.skill}`");
    expect(team).toContain("startupTeam.members.map");
    expect(team).toContain("companionTeams.map");
    expect(team).not.toContain("tracking-[-0.025em]");
    expect(team).toContain("featuredTeamSectionContent");
    expect(content).toContain("export const featuredTeamSectionContent");
    expect(content).toContain("Pick the team for the goal");
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
    expect(page).toContain("resumable");
    expect(page).toContain("action-only state");
    expect(content).toContain("Simulated run");
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

    const copyable = readLandingFile("components/copyable-command.tsx");
    const installCopyable = readLandingFile("components/copyable-install-command.tsx");

    expect(copyable).toContain('"use client"');
    expect(copyable).toContain("await copyText(command, navigator.clipboard)");
    expect(copyable).toContain("Select and copy command");
    expect(copyable).toContain("Copied");
    expect(copyable).toContain("Copy");
    expect(installCopyable).toContain('label="install command"');
  });

  test("renders an optional simulated usage example with a copyable invocation", () => {
    const route = readLandingFile("app/workflows/[slug]/page.tsx");

    expect(existsSync(join(landingRoot, "components", "copyable-command.tsx"))).toBe(true);
    expect(route).toContain('import Image from "next/image"');
    expect(route).toContain("workflow.usageExample");
    expect(route).toContain("<CopyableCommand");
    expect(route).toContain("workflow.usageExample.invocation");
    expect(route).toContain("workflow.usageExample.caption");
    expect(route).toContain("Example input");

    const genericCopyable = readLandingFile("components/copyable-command.tsx");
    expect(genericCopyable).toContain("label: string");
    expect(genericCopyable).toContain("copyLabel: string");
    expect(genericCopyable).toContain("await copyText(command, navigator.clipboard)");
    expect(genericCopyable).toContain("Select and copy command");
    expect(genericCopyable).toMatch(/aria-label=\{`\$\{copyLabel\}:/);
    expect(genericCopyable).toContain('aria-live="polite"');

    const installCopyable = readLandingFile("components/copyable-install-command.tsx");
    expect(installCopyable).toContain("CopyableCommand");
    expect(installCopyable).toContain('label="install command"');
  });

  test("makes every visible landing command click-to-copy", () => {
    const landingPage = readLandingFile("components/landing-page.tsx");
    const hero = readLandingFile("components/startup-team-hero.tsx");
    const finalCta = readLandingFile("components/final-install-cta.tsx");
    const terminal = readLandingFile("components/terminal-block.tsx");
    const copyable = readLandingFile("components/copyable-command.tsx");

    expect(hero).toContain("copyText={content.installCommand}");
    expect(hero).toContain('copyLabel="Copy Startup Team install command"');
    expect(finalCta).toContain("copyText={command}");
    expect(finalCta).toContain('copyLabel="Copy Startup Team install command"');
    expect(landingPage).toContain("copyFeedback");
    expect(landingPage).toContain("await copyText(command.command, navigator.clipboard)");
    expect(landingPage).toContain("aria-label={`Copy command:");
    expect(landingPage).toContain("command.command}`}");
    expect(landingPage).toContain("Select and copy command");

    expect(terminal).toContain("copyLabel?: string");
    expect(terminal).toContain("aria-label={copyLabel ?? `Copy command:");
    expect(terminal).toContain("copyText}`}");
    expect(terminal).toContain("cursor-copy");

    expect(copyable).toMatch(/aria-label=\{`\$\{copyLabel\}:/);
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

  test("matches the approved navigation and keeps FAQ answers in server markup", () => {
    const landingPage = readLandingFile("components/landing-page.tsx");
    const faq = readLandingFile("components/landing-faq.tsx");

    expect(landingPage).toContain('href="#showcase"');
    expect(landingPage).toContain('href="#capabilities"');
    expect(landingPage).toContain('href="#why"');
    expect(landingPage).toContain('href="#workflows"');
    expect(landingPage).toContain('href="#faq"');
    expect(landingPage).toContain('href="#install"');
    expect(faq).toContain("<details");
    expect(faq).toContain("<summary");
    expect(faq).not.toContain("hidden={!expanded}");
  });

  test("renders an accessible control-tower orchestration demo", () => {
    const demo = readLandingFile("components/workflow-run-demo.tsx");
    const content = readLandingFile("lib/landing-content.ts");
    const page = readLandingFile("components/landing-page.tsx");
    const audience = readLandingFile("components/audience-showcase.tsx");

    expect(demo).toContain("export function WorkflowRunDemo");
    expect(demo).toContain("orchestrationCases");
    expect(demo).toContain('role="tablist"');
    expect(demo).toContain('role="tab"');
    expect(demo).toContain("ArrowRight");
    expect(demo).toContain("ArrowLeft");
    expect(demo).toContain("Home");
    expect(demo).toContain("End");
    expect(demo).toContain("IntersectionObserver");
    expect(demo).toContain("document.visibilityState");
    expect(demo).toContain('aria-live="polite"');
    expect(content).toContain("Example run · hardcoded preview");
    expect(demo).toContain("previewLabel");
    expect(demo).toContain("parallelLanes");
    expect(demo).toContain("gatedLanes");
    expect(demo).toContain("Replay");
    expect(demo).toContain("setTimeout");
    expect(demo).toContain("clearTimeout");
    expect(demo).not.toContain("Idea to v1");
    expect(demo).not.toContain("Pivot or focus");
    expect(demo).not.toContain("Customer request");

    const audienceIndex = page.indexOf("<AudienceShowcase");
    const teamIndex = page.indexOf("<FeaturedTeamSection");

    expect(audience).toContain("import { WorkflowRunDemo }");
    expect(audience).toContain("<WorkflowRunDemo");
    expect(audienceIndex).toBeGreaterThan(-1);
    expect(teamIndex).toBeGreaterThan(-1);
    expect(audienceIndex).toBeLessThan(teamIndex);
  });

  test("documents supported agents with logo and neutral text tiles", () => {
    const strip = readLandingFile("components/supported-agent-strip.tsx");
    const content = readLandingFile("lib/landing-content.ts");

    const logoAgents = [
      ["cursor", "agent-logos/cursor.svg"],
      ["codex", "agent-logos/openai.svg"],
      ["claude", "agent-logos/claude.svg"],
      ["github-copilot", "agent-logos/github-copilot.svg"],
    ] as const;

    for (const [agentId, logoPath] of logoAgents) {
      expect(content).toContain(`id: "${agentId}"`);
      expect(content).toContain(`logoSrc: "/${logoPath}"`);
      expect(existsSync(join(landingRoot, "public", logoPath))).toBe(true);
    }
    for (const agent of ["OpenCode", "Hermes", "OpenClaw"]) {
      expect(content).toContain(`name: "${agent}"`);
    }
    expect(content).toContain('name: "GitHub Copilot"');
    expect(content).toContain("Supported Agents");
    expect(content).toContain(
      "Skills install across these agents. Host-managed internal role execution depends on the agent environment; public CLI dispatch is disabled.",
    );
    expect(strip).toContain("agent.logoSrc");
    expect(strip).toContain("agent-logo-fallback");
    expect(strip).toContain("{agent.name}");
    expect(strip).not.toContain("WebkitMask");
  });

  test("keeps attribution with the landing source", () => {
    const attribution = readLandingFile("ATTRIBUTIONS.md");

    expect(attribution).toContain("Create Omniskill Workflows");
    expect(attribution).toContain("Figma");
  });
});
