import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CatalogEntryContent,
  catalogEntries,
  startupTeam,
  workflows,
} from "../landing/lib/landing-content";
import { buildSkillHubEntries } from "../landing/lib/skill-hub";

const repoRoot = join(import.meta.dir, "..");

function manifestPath(entry: CatalogEntryContent) {
  const folder = entry.kind === "team" ? "teams" : "workflows";
  return join(repoRoot, "examples", folder, entry.slug, "workflow.json");
}

function lockPath(entry: CatalogEntryContent) {
  const folder = entry.kind === "team" ? "teams" : "workflows";
  return join(repoRoot, "examples", folder, entry.slug, "workflow.lock.json");
}

function displayName(source: string) {
  if (source.startsWith("./skills/")) return source.slice("./skills/".length);
  if (source.startsWith("catalog:")) return source.slice("catalog:".length);
  return source;
}

describe("landing teams and skill hub data", () => {
  test("models Startup Team separately from standalone workflows", () => {
    expect(startupTeam.kind).toBe("team");
    expect(startupTeam.coordinator.skill).toBe("startup-goal");
    expect(startupTeam.members.map(({ skill }) => skill)).toEqual([
      "ceo",
      "cto",
      "product-manager",
      "web-design",
      "engineering-manager",
      "founding-engineer",
      "qa-lead",
    ]);
    expect(workflows.every(({ kind }) => kind === "workflow")).toBe(true);
    expect(workflows.some(({ slug }) => slug === "startup-team")).toBe(false);
    expect(catalogEntries[0]).toBe(startupTeam);
  });

  test("mirrors workflow manifests and the expanded team lock roster", () => {
    for (const entry of catalogEntries) {
      if (entry.kind === "team") {
        const lock = JSON.parse(readFileSync(lockPath(entry), "utf8")) as {
          skills: Array<{ source: string; resolvedName: string; kind: "local" | "external" }>;
        };
        expect(entry.skills.map(({ name }) => name).sort()).toEqual(
          lock.skills
            .map(({ source, resolvedName, kind }) => (kind === "external" ? source : resolvedName))
            .sort(),
        );
        continue;
      }
      const manifest = JSON.parse(readFileSync(manifestPath(entry), "utf8")) as {
        skills: Array<{ source: string }>;
      };
      expect(entry.skills.map(({ name }) => name)).toEqual(
        manifest.skills.map(({ source }) => displayName(source)),
      );
    }
  });

  test("mirrors the Startup Team coordinator and member manifest fields", () => {
    const manifest = JSON.parse(readFileSync(manifestPath(startupTeam), "utf8")) as {
      coordinator: string;
      members: string[];
    };
    expect(startupTeam.coordinator.skill).toBe(displayName(manifest.coordinator));
    expect(startupTeam.members.map(({ skill }) => skill)).toEqual(
      manifest.members.map((source) => displayName(source)),
    );
  });

  test("deduplicates skills by canonical source and records package use", () => {
    const skills = buildSkillHubEntries(catalogEntries);
    expect(new Set(skills.map(({ id }) => id)).size).toBe(skills.length);

    const cto = skills.find(({ name }) => name === "cto");
    expect(cto?.usedBy.map(({ name }) => name)).toEqual(["Startup Team", "CTO"]);
    expect(cto?.sourceUrl).toContain("/examples/workflows/cto/skills/cto/SKILL.md");

    const implement = skills.find(({ name }) => name === "mattpocock:implement");
    expect(implement?.usedBy.map(({ name }) => name)).toEqual([
      "Startup Team",
      "Founding Engineer",
    ]);
    expect(implement?.sourceUrl).toBe(
      "https://github.com/mattpocock/skills/blob/v1.1.0/skills/engineering/implement/SKILL.md",
    );

    const wayfinder = skills.find(({ name }) => name === "mattpocock:wayfinder");
    expect(wayfinder?.sourceUrl).toBe(
      "https://github.com/mattpocock/skills/blob/v1.1.0/skills/engineering/wayfinder/SKILL.md",
    );
  });

  test("gives every visible skill a canonical source-only destination", () => {
    const skills = buildSkillHubEntries(catalogEntries);
    const expectedNames = new Set(
      catalogEntries.flatMap((entry) =>
        entry.skills.map(({ name }) => (name === "implement" ? "mattpocock:implement" : name)),
      ),
    );
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.map(({ name }) => name)).toEqual(
      [...expectedNames].sort((a, b) => a.localeCompare(b)),
    );
    for (const skill of skills) {
      expect(skill.provider.length).toBeGreaterThan(0);
      expect(skill.sourceUrl.startsWith("https://github.com/")).toBe(true);
      expect(skill.sourceUrl.endsWith("/SKILL.md")).toBe(true);
      expect(skill.usedBy.length).toBeGreaterThan(0);
    }
  });
});
