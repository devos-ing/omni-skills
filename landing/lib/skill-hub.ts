import {
  type CatalogEntryContent,
  catalogEntries,
  getSkillSourceUrl,
  githubUrl,
  type WorkflowSkill,
} from "./landing-content";

export interface SkillHubRelationship {
  slug: string;
  name: string;
  kind: "team" | "workflow";
}

export interface SkillHubEntry {
  id: string;
  name: string;
  description: string;
  provider: string;
  sourceUrl: string;
  usedBy: SkillHubRelationship[];
}

const providerSources: Record<string, { provider: string; root: string }> = {
  emilkowalski: {
    provider: "emilkowalski/skills",
    root: "https://github.com/emilkowalski/skills/blob/main/skills",
  },
  superpowers: {
    provider: "obra/superpowers",
    root: "https://github.com/obra/superpowers/blob/main/skills",
  },
  mattpocock: {
    provider: "mattpocock/skills@v1.1.0",
    root: "https://github.com/mattpocock/skills/blob/v1.1.0/skills/engineering",
  },
};

const aliases: Record<string, string> = {
  implement: "mattpocock:implement",
};

const localSourceOverrides: Record<string, string> = {
  "web-design": `${githubUrl}/blob/main/examples/workflows/web-design/skills/web-design/SKILL.md`,
};

function canonicalName(name: string) {
  return aliases[name] ?? name;
}

function externalSource(name: string) {
  const separator = name.indexOf(":");
  if (separator < 1) return null;
  const providerKey = name.slice(0, separator);
  const skillName = name.slice(separator + 1);
  const provider = providerSources[providerKey];
  if (!provider || !skillName) return null;
  return {
    provider: provider.provider,
    sourceUrl: `${provider.root}/${skillName}/SKILL.md`,
  };
}

function sourceFor(
  entries: CatalogEntryContent[],
  packageEntry: CatalogEntryContent,
  skill: WorkflowSkill,
) {
  const name = canonicalName(skill.name);
  const external = externalSource(name);
  if (external) return { name, ...external };

  const standalone = entries.find(
    (entry) => entry.kind === "workflow" && entry.entrySkill === name,
  );
  const sourceUrl =
    localSourceOverrides[name] ??
    (standalone ? getSkillSourceUrl(standalone, name) : null) ??
    getSkillSourceUrl(packageEntry, skill.name);

  if (!sourceUrl) return null;
  return { name, provider: "devos-ing/omni-skills", sourceUrl };
}

export function buildSkillHubEntries(entries: CatalogEntryContent[]) {
  const bySource = new Map<string, SkillHubEntry>();

  for (const packageEntry of entries) {
    for (const skill of packageEntry.skills) {
      const source = sourceFor(entries, packageEntry, skill);
      if (!source) continue;
      const relationship: SkillHubRelationship = {
        slug: packageEntry.slug,
        name: packageEntry.name,
        kind: packageEntry.kind,
      };
      const existing = bySource.get(source.sourceUrl);
      if (existing) {
        if (!existing.usedBy.some(({ slug }) => slug === packageEntry.slug)) {
          existing.usedBy.push(relationship);
        }
        continue;
      }
      bySource.set(source.sourceUrl, {
        id: source.sourceUrl,
        name: source.name,
        description: skill.description,
        provider: source.provider,
        sourceUrl: source.sourceUrl,
        usedBy: [relationship],
      });
    }
  }

  return [...bySource.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export const skillHubEntries = buildSkillHubEntries(catalogEntries);
