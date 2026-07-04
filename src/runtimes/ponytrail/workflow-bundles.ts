import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { z } from "zod";

const workflowFileName = "workflow.json";
const workflowStoreDir = ".getsuperpower/workflows";
const canonicalExamplesGitUrl = "https://github.com/0xroylee/getsuperpower.git";
const canonicalExamplesWorkflowPath = "examples/workflows";
const workflowAliasPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const WorkflowSkillSchema = z.object({
  source: z.string().min(1),
  repo: z.string().min(1).optional(),
  optional: z.boolean().optional(),
});

const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  skill: z.string().min(1),
  gate: z.enum(["human_approval"]).optional(),
});

export const WorkflowBundleManifestSchema = z
  .object({
    schemaVersion: z.literal("0.1"),
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().min(1),
    skills: z.array(WorkflowSkillSchema).min(1),
    steps: z.array(WorkflowStepSchema).min(1),
  })
  .superRefine((manifest, context) => {
    const stepIds = new Set<string>();
    for (const [index, step] of manifest.steps.entries()) {
      if (stepIds.has(step.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate workflow step id: ${step.id}`,
          path: ["steps", index, "id"],
        });
      }
      stepIds.add(step.id);
    }

    const skillSources = new Set(manifest.skills.map((skill) => skill.source));
    for (const [index, step] of manifest.steps.entries()) {
      if (!skillSources.has(step.skill)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Workflow step ${step.id} references unknown skill: ${step.skill}`,
          path: ["steps", index, "skill"],
        });
      }
    }
  });

export type WorkflowBundleManifest = z.infer<typeof WorkflowBundleManifestSchema>;

export interface WorkflowGitCommand {
  executable: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
}

export interface WorkflowGitCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type WorkflowGitCommandRunner = (
  command: WorkflowGitCommand,
) => Promise<WorkflowGitCommandResult>;

export type WorkflowBundleSource =
  | {
      kind: "local";
      path: string;
    }
  | {
      kind: "git";
      url: string;
      commit?: string;
      subdirectory?: string;
    };

export interface WorkflowBundle {
  manifest: WorkflowBundleManifest;
  sourceDir: string;
  manifestPath: string;
  source: WorkflowBundleSource;
  cleanup?: () => Promise<void>;
}

export interface WorkflowBundleScaffold {
  bundleDir: string;
  manifestPath: string;
  readmePath: string;
  entrySkillPath: string;
}

export interface WorkflowSkillInstallDependency {
  source: string;
  repo?: string;
}

export interface InstalledWorkflowBundle extends WorkflowBundleManifest {
  source: WorkflowBundleSource;
}

export interface WorkflowInstallResult {
  workflow: InstalledWorkflowBundle;
  path: string;
}

export async function loadWorkflowBundle(
  source: string,
  options: {
    cwd?: string;
    runGitCommand?: WorkflowGitCommandRunner;
    tempDir?: string;
  } = {},
): Promise<WorkflowBundle> {
  const resolvedSource = await resolveWorkflowBundleSource(source, {
    cwd: options.cwd ?? process.cwd(),
    ...(options.runGitCommand ? { runGitCommand: options.runGitCommand } : {}),
    ...(options.tempDir ? { tempDir: options.tempDir } : {}),
  });
  const manifestPath = resolvedSource.sourceDir.endsWith(workflowFileName)
    ? resolvedSource.sourceDir
    : join(resolvedSource.sourceDir, workflowFileName);
  const manifestDir = resolvedSource.sourceDir.endsWith(workflowFileName)
    ? dirname(resolvedSource.sourceDir)
    : resolvedSource.sourceDir;

  try {
    const rawManifest = await readFile(manifestPath, "utf8");
    const manifest = WorkflowBundleManifestSchema.parse(JSON.parse(rawManifest));

    return {
      manifest,
      sourceDir: manifestDir,
      manifestPath,
      source: resolvedSource.source,
      ...(resolvedSource.cleanup ? { cleanup: resolvedSource.cleanup } : {}),
    };
  } catch (error) {
    await resolvedSource.cleanup?.();
    if (resolvedSource.alias && resolvedSource.source.kind === "git" && isMissingFileError(error)) {
      throw new Error(
        `GetSuperpower workflow alias not found: ${resolvedSource.alias}\nChecked: ${resolvedSource.source.url}`,
      );
    }
    if (resolvedSource.source.kind === "git" && isMissingFileError(error)) {
      throw new Error(
        `No GetSuperpower workflow manifest was found at ${manifestPath} from public git source: ${resolvedSource.source.url}`,
      );
    }
    throw error;
  }
}

export async function createWorkflowBundleScaffold(input: {
  rootDir: string;
  name: string;
}): Promise<WorkflowBundleScaffold> {
  const bundleDir = join(input.rootDir, input.name);
  const entrySkillDir = join(bundleDir, "skills", input.name);
  const localSkillDir = join(bundleDir, "skills", "custom-review");
  const manifestPath = join(bundleDir, workflowFileName);
  const readmePath = join(bundleDir, "README.md");
  const entrySkillPath = join(entrySkillDir, "SKILL.md");
  const manifest = createScaffoldManifest(input.name);

  await mkdir(entrySkillDir, { recursive: true });
  await mkdir(localSkillDir, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    readmePath,
    `# ${input.name}\n\nA GetSuperpower that composes reusable agent skills.\n`,
  );
  await writeFile(entrySkillPath, createScaffoldEntrySkill(input.name, manifest));
  await writeFile(
    join(localSkillDir, "SKILL.md"),
    [
      "---",
      "name: custom-review",
      'description: "Review this GetSuperpower from the author perspective."',
      "---",
      "",
      "# Custom Review",
      "",
      "Check whether the workflow output matches the GetSuperpower author's stated outcome.",
      "",
    ].join("\n"),
  );

  return { bundleDir, manifestPath, readmePath, entrySkillPath };
}

export async function installWorkflowBundle(input: {
  rootDir: string;
  bundle: WorkflowBundle;
}): Promise<WorkflowInstallResult> {
  const workflow = createInstalledWorkflowBundle(input.bundle);
  const workflowDir = join(input.rootDir, workflowStoreDir);
  const path = join(workflowDir, `${workflow.name}.json`);

  await mkdir(workflowDir, { recursive: true });
  await writeFile(path, `${JSON.stringify(workflow, null, 2)}\n`);

  return { workflow, path };
}

export async function listInstalledWorkflowBundles(input: {
  rootDir: string;
}): Promise<InstalledWorkflowBundle[]> {
  const workflowDir = join(input.rootDir, workflowStoreDir);
  if (!existsSync(workflowDir)) {
    return [];
  }

  const entries = await readdir(workflowDir, { withFileTypes: true });
  const workflows: InstalledWorkflowBundle[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const raw = await readFile(join(workflowDir, entry.name), "utf8");
    workflows.push(JSON.parse(raw) as InstalledWorkflowBundle);
  }

  return workflows.sort((left, right) => left.name.localeCompare(right.name));
}

export function getWorkflowSkillInstallSources(bundle: WorkflowBundle): string[] {
  return getWorkflowSkillInstallDependencies(bundle).map((skill) => skill.source);
}

export function getWorkflowSkillInstallDependencies(
  bundle: WorkflowBundle,
): WorkflowSkillInstallDependency[] {
  return bundle.manifest.skills.map((skill) => {
    const source =
      skill.source.startsWith("./") || skill.source.startsWith("../")
        ? resolve(bundle.sourceDir, skill.source)
        : skill.source;
    return {
      source,
      ...(skill.repo ? { repo: skill.repo } : {}),
    };
  });
}

function createInstalledWorkflowBundle(bundle: WorkflowBundle): InstalledWorkflowBundle {
  return {
    ...bundle.manifest,
    source: bundle.source,
  };
}

function createScaffoldManifest(name: string): WorkflowBundleManifest {
  return WorkflowBundleManifestSchema.parse({
    schemaVersion: "0.1",
    name,
    version: "0.1.0",
    description: `GetSuperpower for ${name}.`,
    skills: [
      { source: `./skills/${name}` },
      { source: "superpowers:brainstorming", repo: "obra/superpowers" },
      { source: "./skills/custom-review" },
      { source: "superpowers:writing-plans", repo: "obra/superpowers" },
    ],
    steps: [
      {
        id: "shape",
        title: "Shape the request",
        skill: "superpowers:brainstorming",
        gate: "human_approval",
      },
      {
        id: "custom-review",
        title: "Run the bundle-specific review",
        skill: "./skills/custom-review",
        gate: "human_approval",
      },
      {
        id: "plan",
        title: "Write the implementation plan",
        skill: "superpowers:writing-plans",
      },
    ],
  });
}

function createScaffoldEntrySkill(name: string, manifest: WorkflowBundleManifest): string {
  return [
    "---",
    `name: ${name}`,
    `description: "Use when running the ${name} GetSuperpower workflow, bundle skill, skill tree, or orchestrated multi-skill workflow."`,
    "---",
    "",
    `# ${name} GetSuperpower`,
    "",
    `This is the entry skill for the ${name} GetSuperpower.`,
    "",
    "When this skill is used, run the workflow below in order. Load/use every required sub-skill before doing the work for its phase.",
    "",
    "## Required Sub-Skills",
    "",
    ...manifest.steps.flatMap((step, index) => [
      `${index + 1}. ${formatEntrySkillSource(step.skill)} - ${step.title}`,
    ]),
    "",
    "If any required sub-skill is unavailable, stop and tell the user which dependency is missing.",
    "",
    "## Workflow",
    "",
    ...manifest.steps.flatMap((step, index) => [
      `${index + 1}. ${step.title}`,
      `   - Skill: ${formatEntrySkillSource(step.skill)}`,
      ...(step.gate === "human_approval" ? ["   - Gate: wait for explicit human approval."] : []),
    ]),
    "",
    "## Author Notes",
    "",
    "- Keep this entry skill, `workflow.json`, and `README.md` aligned when adding or removing steps.",
    "- The entry skill orchestrates through required instructions; GetSuperpower installs and validates the dependency skills.",
    "- Do not silently skip a missing sub-skill.",
    "",
  ].join("\n");
}

function formatEntrySkillSource(source: string): string {
  if (source.startsWith("./skills/")) {
    const skillName = source.slice("./skills/".length);
    return `${skillName} (${source})`;
  }

  return source;
}

interface ResolvedWorkflowBundleSource {
  sourceDir: string;
  source: WorkflowBundleSource;
  cleanup?: () => Promise<void>;
  alias?: string;
}

async function resolveWorkflowBundleSource(
  source: string,
  options: {
    cwd: string;
    runGitCommand?: WorkflowGitCommandRunner;
    tempDir?: string;
  },
): Promise<ResolvedWorkflowBundleSource> {
  const aliasSource = parseWorkflowAliasSource(source);
  if (aliasSource) {
    return cloneGitWorkflowSource(aliasSource, options);
  }

  const gitSource = parseGitWorkflowSource(source);
  if (gitSource) {
    return cloneGitWorkflowSource(gitSource, options);
  }

  if (isLocalWorkflowSource(source)) {
    const sourceDir = isAbsolute(source) ? source : resolve(options.cwd, source);
    return { sourceDir, source: { kind: "local", path: sourceDir } };
  }

  throw new Error(
    `Unsupported GetSuperpower source: ${source}. Use a local path, workflow.json path, public git URL, or lowercase workflow alias.`,
  );
}

function parseWorkflowAliasSource(source: string): GitWorkflowSource | null {
  if (!workflowAliasPattern.test(source)) {
    return null;
  }

  const url = `${canonicalExamplesGitUrl}#${canonicalExamplesWorkflowPath}/${source}`;
  const gitSource = parseGitWorkflowSource(url);
  if (!gitSource) {
    throw new Error(`Could not build canonical GetSuperpower workflow alias URL: ${source}`);
  }

  return { ...gitSource, alias: source };
}

function isLocalWorkflowSource(source: string): boolean {
  return (
    source === "." ||
    source === ".." ||
    source.startsWith("./") ||
    source.startsWith("../") ||
    source.startsWith("/") ||
    source.includes("/") ||
    source.endsWith(".json")
  );
}

interface GitWorkflowSource {
  cloneUrl: string;
  url: string;
  subdirectory?: string;
  alias?: string;
}

function parseGitWorkflowSource(source: string): GitWorkflowSource | null {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "file:") {
    return null;
  }

  const subdirectory = parseGitWorkflowSubdirectory(url.hash);
  url.hash = "";

  return {
    cloneUrl: url.toString(),
    url: source,
    ...(subdirectory ? { subdirectory } : {}),
  };
}

function parseGitWorkflowSubdirectory(hash: string): string | undefined {
  if (!hash) {
    return undefined;
  }

  const rawHash = decodeURIComponent(hash.slice(1));
  const params = new URLSearchParams(rawHash);
  const candidate = params.get("path") ?? (rawHash.includes("=") ? undefined : rawHash);
  if (!candidate) {
    return undefined;
  }

  const normalized = candidate
    .split("/")
    .filter((part) => part.length > 0 && part !== ".")
    .join("/");
  if (!normalized) {
    return undefined;
  }
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    isAbsolute(normalized)
  ) {
    throw new Error(`Unsupported public git workflow subdirectory: ${candidate}`);
  }

  return normalized;
}

async function cloneGitWorkflowSource(
  source: GitWorkflowSource,
  options: {
    cwd: string;
    runGitCommand?: WorkflowGitCommandRunner;
    tempDir?: string;
  },
): Promise<ResolvedWorkflowBundleSource> {
  const tempRoot = await mkdtemp(join(options.tempDir ?? tmpdir(), "getsuperpower-git-"));
  const checkoutDir = join(tempRoot, "checkout");
  const cleanup = () => rm(tempRoot, { recursive: true, force: true });

  try {
    await runRequiredGitCommand(
      {
        executable: "git",
        args: ["clone", "--depth", "1", source.cloneUrl, checkoutDir],
        cwd: options.cwd,
        env: process.env,
      },
      options.runGitCommand,
      `Public git workflow source could not be fetched: ${source.url}`,
    );

    const commitResult = await runOptionalGitCommand(
      {
        executable: "git",
        args: ["rev-parse", "HEAD"],
        cwd: checkoutDir,
        env: process.env,
      },
      options.runGitCommand,
    );
    const commit = commitResult.exitCode === 0 ? commitResult.stdout.trim() : undefined;
    const sourceDir = source.subdirectory ? join(checkoutDir, source.subdirectory) : checkoutDir;

    return {
      sourceDir,
      source: {
        kind: "git",
        url: source.url,
        ...(commit ? { commit } : {}),
        ...(source.subdirectory ? { subdirectory: source.subdirectory } : {}),
      },
      cleanup,
      ...(source.alias ? { alias: source.alias } : {}),
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function runRequiredGitCommand(
  command: WorkflowGitCommand,
  runGitCommand: WorkflowGitCommandRunner | undefined,
  failureMessage: string,
): Promise<WorkflowGitCommandResult> {
  const result = await runOptionalGitCommand(command, runGitCommand);
  if (result.exitCode !== 0) {
    const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n");
    throw new Error(detail ? `${failureMessage}\n${detail}` : failureMessage);
  }
  return result;
}

async function runOptionalGitCommand(
  command: WorkflowGitCommand,
  runGitCommand: WorkflowGitCommandRunner | undefined,
): Promise<WorkflowGitCommandResult> {
  if (runGitCommand) {
    return runGitCommand(command);
  }

  const subprocess = Bun.spawn([command.executable, ...command.args], {
    cwd: command.cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: command.env,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return { stdout, stderr, exitCode };
}

function isMissingFileError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}
