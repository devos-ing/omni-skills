import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createDefaultManifest, writeManifest } from "./manifest";

export interface CreateOnboardingFilesInput {
  rootDir: string;
  projectName: string;
}

export interface CreateOnboardingFilesResult {
  courtDir: string;
  manifestPath: string;
  created: string[];
}

export async function createOnboardingFiles(
  input: CreateOnboardingFilesInput,
): Promise<CreateOnboardingFilesResult> {
  const courtDir = join(input.rootDir, ".goal-court");
  const goalsDir = join(courtDir, "goals");
  const pluginsDir = join(courtDir, "plugins");
  const skillsDir = join(courtDir, "skills");
  const runtimesDir = join(courtDir, "runtimes");
  const manifestPath = join(courtDir, "manifest.json");
  const readmePath = join(courtDir, "README.md");
  const gitkeepPath = join(goalsDir, ".gitkeep");

  await Promise.all([
    mkdir(goalsDir, { recursive: true }),
    mkdir(pluginsDir, { recursive: true }),
    mkdir(skillsDir, { recursive: true }),
    mkdir(runtimesDir, { recursive: true }),
  ]);
  await writeManifest(manifestPath, createDefaultManifest({ name: input.projectName }));
  await writeFile(readmePath, createReadme(input.projectName));
  await writeFile(gitkeepPath, "");

  return {
    courtDir,
    manifestPath,
    created: [manifestPath, readmePath, goalsDir, pluginsDir, skillsDir, runtimesDir, gitkeepPath],
  };
}

function createReadme(projectName: string): string {
  return `# ${projectName} Goal Court

This directory stores requirement-first runtime files for AI agent work.

## Flow

1. Draft a goal with \`/goal "<request>"\`.
2. Let the Product, Engineering, and Verification bots discuss the direction.
3. Lock the goal only after at least 2 of 3 bots approve and the human owner approves.
4. Start Codex, Claude, or another worker agent with the locked goal contract.
5. Use \`/amend-goal\` when execution discovers the goal must change.

Generated files under \`.goal-court/goals\` should be treated as an append-only evidence trail.

## Local Extension Folders

- \`.goal-court/runtimes\`: runtime-specific configuration and policies.
- \`.goal-court/plugins\`: adapters for workers, evidence sources, and integrations.
- \`.goal-court/skills\`: reusable judge or drafting capabilities.
`;
}
