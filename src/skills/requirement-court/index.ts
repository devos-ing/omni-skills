import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { RuntimeSkill } from "../types";

export interface ManifestSkillDefinition {
  displayName: string;
  description: string;
  instruction: string;
}

export type DefaultRequirementCourtSkillId =
  | "intent_alignment"
  | "scope_control"
  | "feasibility_review"
  | "verification_design"
  | "risk_review"
  | "goal_rewrite";

interface SkillFileMetadata {
  id: DefaultRequirementCourtSkillId;
  displayName: string;
  description: string;
}

const DEFAULT_REQUIREMENT_COURT_SKILL_FOLDERS = [
  "intent-alignment",
  "scope-control",
  "feasibility-review",
  "verification-design",
  "risk-review",
  "goal-rewrite",
] as const;

export const DEFAULT_REQUIREMENT_REVIEW_SKILL_IDS = [
  "intent_alignment",
  "scope_control",
  "feasibility_review",
  "verification_design",
  "risk_review",
] as const satisfies readonly DefaultRequirementCourtSkillId[];

export function loadDefaultRequirementCourtSkills(): RuntimeSkill[] {
  const skillsDir = findRequirementCourtSkillsDir();

  return DEFAULT_REQUIREMENT_COURT_SKILL_FOLDERS.map((folder) =>
    loadRequirementCourtSkillFile(join(skillsDir, folder, "SKILL.md")),
  );
}

export function createDefaultSkillRegistry(): Record<
  DefaultRequirementCourtSkillId,
  ManifestSkillDefinition
> {
  return Object.fromEntries(
    loadDefaultRequirementCourtSkills().map((skill) => [
      skill.id,
      {
        displayName: skill.displayName,
        description: skill.description,
        instruction: skill.instruction,
      },
    ]),
  ) as Record<DefaultRequirementCourtSkillId, ManifestSkillDefinition>;
}

function findRequirementCourtSkillsDir(): string {
  const currentDir = dirname(new URL(import.meta.url).pathname);
  const candidates = [
    currentDir,
    join(currentDir, "..", "..", "..", "src", "skills", "requirement-court"),
  ];

  const found = candidates.find((candidate) =>
    existsSync(join(candidate, "intent-alignment", "SKILL.md")),
  );
  if (!found) {
    throw new Error("Unable to locate requirement-court skill files.");
  }

  return found;
}

function loadRequirementCourtSkillFile(path: string): RuntimeSkill {
  const raw = readFileSync(path, "utf8");
  const { metadata, body } = parseSkillFile(raw, path);

  return {
    id: metadata.id,
    displayName: metadata.displayName,
    description: metadata.description,
    instruction: body,
  };
}

function parseSkillFile(raw: string, path: string): { metadata: SkillFileMetadata; body: string } {
  const match = /^---\n(?<frontmatter>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/u.exec(raw);
  const frontmatter = match?.groups?.frontmatter;
  const body = match?.groups?.body;
  if (frontmatter === undefined || body === undefined) {
    throw new Error(`Requirement-court skill ${basename(path)} is missing frontmatter.`);
  }

  const values = Object.fromEntries(
    frontmatter.split("\n").map((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) {
        throw new Error(`Invalid frontmatter line in ${basename(path)}: ${line}`);
      }

      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
  );

  return {
    metadata: {
      id: parseDefaultRequirementCourtSkillId(values.id, path),
      displayName: parseRequiredFrontmatter(values.displayName, "displayName", path),
      description: parseRequiredFrontmatter(values.description, "description", path),
    },
    body: body.trim(),
  };
}

function parseDefaultRequirementCourtSkillId(
  value: string | undefined,
  path: string,
): DefaultRequirementCourtSkillId {
  const id = parseRequiredFrontmatter(value, "id", path);
  if (
    id === "intent_alignment" ||
    id === "scope_control" ||
    id === "feasibility_review" ||
    id === "verification_design" ||
    id === "risk_review" ||
    id === "goal_rewrite"
  ) {
    return id;
  }

  throw new Error(`Unknown requirement-court skill id in ${basename(path)}: ${id}`);
}

function parseRequiredFrontmatter(value: string | undefined, field: string, path: string): string {
  if (!value) {
    throw new Error(`Requirement-court skill ${basename(path)} is missing ${field}.`);
  }

  return value;
}
