import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { runSubprocess } from "../../process";

export const workflowFileName = "workflow.json";
export const workflowLockFileName = "workflow.lock.json";
const workflowStoreDir = ".omniskills/workflows";
const canonicalExamplesGitUrl = "https://github.com/devos-ing/omni-skills.git";
const canonicalExamplesTeamPath = "examples/teams";
const canonicalExamplesWorkflowPath = "examples/workflows";
const workflowAliasPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const WorkflowSkillSchema = z.object({
  source: z.string().min(1),
  repo: z.string().min(1).optional(),
  optional: z.boolean().optional(),
  entry: z.boolean().optional(),
});

const WorkflowStepVerifySchema = z.object({
  type: z.enum(["human_approval", "event", "manual"]),
  event: z.string().min(1).optional(),
  message_includes: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
});

const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  skill: z.string().min(1),
  gate: z.enum(["human_approval"]).optional(),
  instruction: z.string().min(1).optional(),
  verify: WorkflowStepVerifySchema.optional(),
});

const WorkflowLoopSchema = z.object({
  script: z.string().min(1),
  state: z.literal("global"),
  execution: z.literal("action-only"),
  type: z.enum(["goal_based"]).optional(),
  goal: z.string().min(1).optional(),
  done_when: z.array(z.string().min(1)).min(1).optional(),
  stop_when: z.array(z.string().min(1)).min(1).optional(),
});

export const WorkflowBundleManifestSchema = z
  .object({
    schemaVersion: z.literal("0.1"),
    kind: z.enum(["workflow", "team"]).optional(),
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().min(1),
    coordinator: z.string().min(1).optional(),
    members: z.array(z.string().min(1)).optional(),
    loop: WorkflowLoopSchema.optional(),
    skills: z.array(WorkflowSkillSchema).min(1),
    steps: z.array(WorkflowStepSchema).min(1),
  })
  .superRefine((manifest, context) => {
    if (!parseWorkflowSemver(manifest.version)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid workflow semantic version: ${manifest.version}`,
        path: ["version"],
      });
    }

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
    const effectiveKind = manifest.kind ?? "workflow";

    if (effectiveKind === "team") {
      if (!manifest.coordinator) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Team manifests must declare a coordinator",
          path: ["coordinator"],
        });
      } else {
        if (!skillSources.has(manifest.coordinator)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Team coordinator references unknown skill: ${manifest.coordinator}`,
            path: ["coordinator"],
          });
        }
        if (!isLocalWorkflowSkillSource(manifest.coordinator)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Team coordinator must be a local skill path: ${manifest.coordinator}`,
            path: ["coordinator"],
          });
        }
        const coordinatorSkill = manifest.skills.find(
          (skill) => skill.source === manifest.coordinator,
        );
        if (coordinatorSkill && coordinatorSkill.entry !== true) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Team coordinator must be marked as the entry skill",
            path: ["coordinator"],
          });
        }
      }

      if (!manifest.members || manifest.members.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Team manifests must declare at least one member",
          path: ["members"],
        });
      } else {
        const seenMembers = new Set<string>();
        for (const [index, member] of manifest.members.entries()) {
          if (!skillSources.has(member)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Team member references unknown skill: ${member}`,
              path: ["members", index],
            });
          }
          if (seenMembers.has(member)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Duplicate team member: ${member}`,
              path: ["members", index],
            });
          }
          if (member === manifest.coordinator) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Team coordinator cannot also be a member: ${member}`,
              path: ["members", index],
            });
          }
          seenMembers.add(member);
        }
      }
    } else if (manifest.coordinator !== undefined || manifest.members !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Workflow manifests cannot declare coordinator or members",
        path: [manifest.coordinator !== undefined ? "coordinator" : "members"],
      });
    }

    for (const [index, step] of manifest.steps.entries()) {
      if (!skillSources.has(step.skill)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Workflow step ${step.id} references unknown skill: ${step.skill}`,
          path: ["steps", index, "skill"],
        });
      }
    }

    const entrySkillIndexes = manifest.skills
      .map((skill, index) => (skill.entry === true ? index : -1))
      .filter((index) => index >= 0);

    if (entrySkillIndexes.length > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only one workflow skill can be marked as entry",
        path: ["skills"],
      });
    }

    if (manifest.loop && entrySkillIndexes.length !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Looped workflows must declare exactly one entry skill",
        path: ["skills"],
      });
    }

    if (manifest.loop && entrySkillIndexes.length === 1) {
      const entrySkillIndex = entrySkillIndexes[0] ?? 0;
      const entrySkill = manifest.skills[entrySkillIndex];
      if (entrySkill && !isLocalWorkflowSkillSource(entrySkill.source)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Looped workflow entry skill must be a local skill path",
          path: ["skills", entrySkillIndex, "source"],
        });
      }
    }

    if (manifest.loop?.type === "goal_based") {
      if (!manifest.loop.goal) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Goal-based loops must declare loop.goal",
          path: ["loop", "goal"],
        });
      }
      if (!manifest.loop.done_when) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Goal-based loops must declare loop.done_when",
          path: ["loop", "done_when"],
        });
      }
      if (!manifest.loop.stop_when) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Goal-based loops must declare loop.stop_when",
          path: ["loop", "stop_when"],
        });
      }
    }
  });

export type WorkflowBundleManifest = z.infer<typeof WorkflowBundleManifestSchema>;

export function getWorkflowInvocationSkillName(manifest: WorkflowBundleManifest): string | null {
  if (manifest.kind !== "team" || !manifest.coordinator) {
    return null;
  }
  return basename(manifest.coordinator);
}

const WorkflowSkillLockEntrySchema = z.object({
  source: z.string().min(1),
  resolvedName: z.string().min(1),
  kind: z.enum(["local", "external"]),
  repo: z.string().min(1).optional(),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

const LegacyWorkflowLockFileSchema = z.object({
  schemaVersion: z.literal("0.1"),
  workflow: z.string().min(1),
  workflowVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  skills: z.array(WorkflowSkillLockEntrySchema).min(1),
});

const LockedWorkflowSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("root") }),
  z.object({ kind: z.literal("local"), path: z.string().min(1) }),
  z.object({
    kind: z.literal("git"),
    url: z.string().min(1),
    commit: z.string().min(1),
    subdirectory: z.string().min(1).optional(),
  }),
]);

const WorkflowDependencyGraphWorkflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  source: LockedWorkflowSourceSchema,
});

const WorkflowDependencyGraphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const TransitiveWorkflowLockFileSchema = z.object({
  schemaVersion: z.literal("0.2"),
  workflow: z.string().min(1),
  workflowVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  workflows: z.array(WorkflowDependencyGraphWorkflowSchema).min(1),
  edges: z.array(WorkflowDependencyGraphEdgeSchema),
  skills: z.array(WorkflowSkillLockEntrySchema).min(1),
});

export const WorkflowLockFileSchema = z.union([
  LegacyWorkflowLockFileSchema,
  TransitiveWorkflowLockFileSchema,
]);

export type WorkflowSkillLockEntry = z.infer<typeof WorkflowSkillLockEntrySchema>;
export type WorkflowLockFile = z.infer<typeof WorkflowLockFileSchema>;

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
  lock?: WorkflowLockFile;
  lockPath?: string;
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

export interface WorkflowDependencyResolver {
  resolve(input: {
    dependency: WorkflowSkillInstallDependency;
    parent: WorkflowBundle;
  }): Promise<WorkflowBundle | null>;
}

export interface WorkflowDependencyGraphWorkflow {
  id: string;
  name: string;
  version: string;
  source: WorkflowBundleSource;
}

export interface WorkflowDependencyGraphEdge {
  from: string;
  to: string;
}

export interface WorkflowDependencyGraph {
  dependencies: WorkflowSkillInstallDependency[];
  displaySources: string[];
  workflows: WorkflowDependencyGraphWorkflow[];
  edges: WorkflowDependencyGraphEdge[];
  cleanup?: () => Promise<void>;
}

export interface WorkflowInstallSkillArtifact {
  source: string;
  skillName: string;
  agent: string;
  status: string;
  paths: string[];
}

export interface WorkflowRemovalArtifact {
  source: string;
  skillName: string;
  agent: string;
  status: string;
  path: string;
}

export interface WorkflowRemovalKeptArtifact extends WorkflowRemovalArtifact {
  usedByWorkflows: string[];
}

export interface WorkflowRemovalSkippedArtifact {
  source: string;
  reason: string;
}

export interface WorkflowRemovalPlan {
  workflow: InstalledWorkflowBundle;
  workflowRecordPath: string;
  legacy: boolean;
  artifactsToRemove: WorkflowRemovalArtifact[];
  artifactsToKeep: WorkflowRemovalKeptArtifact[];
  skippedArtifacts: WorkflowRemovalSkippedArtifact[];
}

export interface WorkflowLoopMetadata {
  schemaVersion: "0.1";
  workflow: string;
  entrySkill: string;
  loopScript: string;
  state: "global";
  execution: "action-only";
  type?: "goal_based";
  goal?: string;
  done_when?: string[];
  stop_when?: string[];
  commands: ["start", "status", "log", "advance", "summary"];
}

export interface PreparedWorkflowSkillInstallDependencies {
  dependencies: WorkflowSkillInstallDependency[];
  displaySources: string[];
  cleanup?: () => Promise<void>;
}

export interface InstalledWorkflowBundle extends WorkflowBundleManifest {
  source: WorkflowBundleSource;
  installArtifacts?: WorkflowInstallSkillArtifact[];
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
    commit?: string;
  } = {},
): Promise<WorkflowBundle> {
  const resolvedSource = await resolveWorkflowBundleSource(source, {
    cwd: options.cwd ?? process.cwd(),
    ...(options.runGitCommand ? { runGitCommand: options.runGitCommand } : {}),
    ...(options.tempDir ? { tempDir: options.tempDir } : {}),
    ...(options.commit ? { commit: options.commit } : {}),
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
    if (resolvedSource.alias?.endsWith("-team") && manifest.kind !== "team") {
      throw new Error(
        `Omniskills team alias "${resolvedSource.alias}" must resolve to kind: "team"`,
      );
    }
    validateWorkflowBundleFiles({ manifest, sourceDir: manifestDir });
    const loadedLock = await loadWorkflowLockFileForManifest({ manifest, sourceDir: manifestDir });

    return {
      manifest,
      sourceDir: manifestDir,
      manifestPath,
      ...(loadedLock ? { lock: loadedLock.lock, lockPath: loadedLock.path } : {}),
      source: resolvedSource.source,
      ...(resolvedSource.cleanup ? { cleanup: resolvedSource.cleanup } : {}),
    };
  } catch (error) {
    await resolvedSource.cleanup?.();
    if (resolvedSource.alias && resolvedSource.source.kind === "git" && isMissingFileError(error)) {
      throw new Error(
        `Omniskills workflow alias not found: ${resolvedSource.alias}\nChecked: ${resolvedSource.source.url}`,
      );
    }
    if (resolvedSource.source.kind === "git" && isMissingFileError(error)) {
      throw new Error(
        `No Omniskills workflow manifest was found at ${manifestPath} from public git source: ${resolvedSource.source.url}`,
      );
    }
    throw error;
  }
}

export async function loadWorkflowLockFile(
  bundle: WorkflowBundle,
): Promise<WorkflowLockFile | null> {
  return (
    (
      await loadWorkflowLockFileForManifest({
        manifest: bundle.manifest,
        sourceDir: bundle.sourceDir,
      })
    )?.lock ?? null
  );
}

export async function createWorkflowLockFile(
  bundle: WorkflowBundle,
  options: {
    generatedAt?: Date | string;
    runGitCommand?: WorkflowGitCommandRunner;
    tempDir?: string;
    installedRootDir?: string;
  } = {},
): Promise<WorkflowLockFile> {
  const generatedAt =
    typeof options.generatedAt === "string"
      ? options.generatedAt
      : (options.generatedAt ?? new Date()).toISOString();

  const graph = await resolveWorkflowDependencyGraph({
    bundle,
    ignoreLockValidation: true,
    ...(options.runGitCommand ? { runGitCommand: options.runGitCommand } : {}),
    ...(options.tempDir ? { tempDir: options.tempDir } : {}),
    ...(options.installedRootDir ? { installedRootDir: options.installedRootDir } : {}),
  });
  try {
    return WorkflowLockFileSchema.parse({
      schemaVersion: "0.2",
      workflow: bundle.manifest.name,
      workflowVersion: bundle.manifest.version,
      generatedAt,
      workflows: createLockedWorkflowGraph(bundle.sourceDir, graph.workflows),
      edges: graph.edges,
      skills: await createWorkflowLockSkillEntries(bundle.sourceDir, graph.dependencies),
    });
  } finally {
    await graph.cleanup?.();
  }
}

export async function writeWorkflowLockFile(
  bundle: WorkflowBundle,
  options: Parameters<typeof createWorkflowLockFile>[1] = {},
): Promise<{ lock: WorkflowLockFile; path: string }> {
  const lock = await createWorkflowLockFile(bundle, options);
  const path = join(bundle.sourceDir, workflowLockFileName);
  await writeFile(path, `${JSON.stringify(lock, null, 2)}\n`);
  return { lock, path };
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
    `# ${input.name}\n\nAn Omniskills workflow that composes reusable agent skills.\n`,
  );
  await writeFile(entrySkillPath, createScaffoldEntrySkill(input.name, manifest));
  await writeFile(
    join(localSkillDir, "SKILL.md"),
    [
      "---",
      "name: custom-review",
      'description: "Review this Omniskills workflow from the author perspective."',
      "---",
      "",
      "# Custom Review",
      "",
      "Check whether the workflow output matches the Omniskills author's stated outcome.",
      "",
    ].join("\n"),
  );

  return { bundleDir, manifestPath, readmePath, entrySkillPath };
}

export async function installWorkflowBundle(input: {
  rootDir: string;
  bundle: WorkflowBundle;
  installArtifacts?: WorkflowInstallSkillArtifact[];
}): Promise<WorkflowInstallResult> {
  const workflow = createInstalledWorkflowBundle(input.bundle, input.installArtifacts ?? []);
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

export function getInstalledWorkflowBundlePath(input: {
  rootDir: string;
  workflowName: string;
}): string {
  return join(input.rootDir, workflowStoreDir, `${input.workflowName}.json`);
}

export async function loadInstalledWorkflowBundle(input: {
  rootDir: string;
  workflowName: string;
}): Promise<{ workflow: InstalledWorkflowBundle; path: string }> {
  const path = getInstalledWorkflowBundlePath(input);
  try {
    const raw = await readFile(path, "utf8");
    return { workflow: JSON.parse(raw) as InstalledWorkflowBundle, path };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Omniskills workflow is not installed: ${input.workflowName}`);
    }
    throw error;
  }
}

export async function createWorkflowRemovalPlan(input: {
  rootDir: string;
  homeDir: string;
  workflowName: string;
}): Promise<WorkflowRemovalPlan> {
  const installed = await loadInstalledWorkflowBundle({
    rootDir: input.rootDir,
    workflowName: input.workflowName,
  });
  const otherWorkflows = (await listInstalledWorkflowBundles({ rootDir: input.rootDir })).filter(
    (workflow) => workflow.name !== input.workflowName,
  );
  const legacy = !installed.workflow.installArtifacts?.length;
  const skippedArtifacts: WorkflowRemovalSkippedArtifact[] = [];
  const candidates = legacy
    ? inferLegacyRemovalArtifacts(installed.workflow, input.homeDir, skippedArtifacts)
    : flattenInstallArtifacts(installed.workflow.installArtifacts ?? []);
  const otherPathOwners = getArtifactPathOwners(otherWorkflows);
  const artifactsToRemove: WorkflowRemovalArtifact[] = [];
  const artifactsToKeep: WorkflowRemovalKeptArtifact[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (seen.has(candidate.path)) {
      continue;
    }
    seen.add(candidate.path);
    const usedByWorkflows = otherPathOwners.get(candidate.path) ?? [];
    if (usedByWorkflows.length > 0) {
      artifactsToKeep.push({ ...candidate, usedByWorkflows });
      continue;
    }
    artifactsToRemove.push(candidate);
  }

  return {
    workflow: installed.workflow,
    workflowRecordPath: installed.path,
    legacy,
    artifactsToRemove,
    artifactsToKeep,
    skippedArtifacts,
  };
}

export async function executeWorkflowRemovalPlan(plan: WorkflowRemovalPlan): Promise<void> {
  for (const artifact of plan.artifactsToRemove) {
    await rm(artifact.path, { recursive: true, force: true });
  }
  await rm(plan.workflowRecordPath, { force: true });
}

export function getWorkflowSkillInstallSources(bundle: WorkflowBundle): string[] {
  return getWorkflowSkillInstallDependencies(bundle).map((skill) => skill.source);
}

export function getWorkflowSkillInstallDependencies(
  bundle: WorkflowBundle,
): WorkflowSkillInstallDependency[] {
  return bundle.manifest.skills.map((skill) => {
    const source = isLocalWorkflowSkillSource(skill.source)
      ? resolve(bundle.sourceDir, skill.source)
      : skill.source;
    return {
      source,
      ...(skill.repo ? { repo: skill.repo } : {}),
    };
  });
}

function validateResolvedTeamMembers(input: {
  root: WorkflowBundle;
  resolvedChildren: Map<string, WorkflowBundle>;
  selectedByName: Map<string, WorkflowBundle>;
}): void {
  if (input.root.manifest.kind !== "team") {
    return;
  }

  const rootId = getCanonicalWorkflowIdentity(input.root);
  const workflowNames = new Set<string>();
  const entryNames = new Set<string>();

  for (const member of input.root.manifest.members ?? []) {
    const index = input.root.manifest.skills.findIndex((skill) => skill.source === member);
    const discovered = input.resolvedChildren.get(`${rootId}\n${index}`);
    const child = discovered
      ? (input.selectedByName.get(discovered.manifest.name) ?? discovered)
      : null;
    const entries = child?.manifest.skills.filter((skill) => skill.entry === true) ?? [];
    const entry = entries[0];
    if (!child || entries.length !== 1 || !entry || !isLocalWorkflowSkillSource(entry.source)) {
      throw new Error(
        `Team member must reference a child workflow with exactly one local entry skill: ${member}`,
      );
    }
    if (workflowNames.has(child.manifest.name)) {
      throw new Error(`Duplicate resolved team workflow: ${child.manifest.name}`);
    }
    const entryName = basename(entry.source);
    if (entryNames.has(entryName)) {
      throw new Error(`Duplicate resolved team entry skill: ${entryName}`);
    }
    workflowNames.add(child.manifest.name);
    entryNames.add(entryName);
  }
}

export async function resolveWorkflowDependencyGraph(input: {
  bundle: WorkflowBundle;
  resolver?: WorkflowDependencyResolver;
  runGitCommand?: WorkflowGitCommandRunner;
  tempDir?: string;
  installedRootDir?: string;
  ignoreLockValidation?: boolean;
}): Promise<WorkflowDependencyGraph> {
  const resolver =
    input.resolver ??
    createDefaultWorkflowDependencyResolver({
      ...(!input.ignoreLockValidation && input.bundle.lock ? { lock: input.bundle.lock } : {}),
      ...(input.runGitCommand ? { runGitCommand: input.runGitCommand } : {}),
      ...(input.tempDir ? { tempDir: input.tempDir } : {}),
      ...(input.installedRootDir ? { installedRootDir: input.installedRootDir } : {}),
    });
  const discovered = new Map<string, WorkflowBundle>();
  const resolvedChildren = new Map<string, WorkflowBundle>();
  const selectedByName = new Map<string, WorkflowBundle>();
  const cleanups: Array<() => Promise<void>> = [];

  const discover = async (bundle: WorkflowBundle, active: WorkflowBundle[]): Promise<void> => {
    assertValidWorkflowSemver(bundle);
    const canonicalId = getCanonicalWorkflowIdentity(bundle);
    const cycleIndex = active.findIndex(
      (candidate) => getCanonicalWorkflowIdentity(candidate) === canonicalId,
    );
    if (cycleIndex >= 0) {
      throw new Error(
        `Workflow dependency cycle: ${[
          ...active.slice(cycleIndex).map(getDisplayWorkflowIdentity),
          getDisplayWorkflowIdentity(bundle),
        ].join(" -> ")}`,
      );
    }
    if (discovered.has(canonicalId)) {
      return;
    }
    discovered.set(canonicalId, bundle);

    const selected = selectedByName.get(bundle.manifest.name);
    if (
      !selected ||
      compareWorkflowSemver(bundle.manifest.version, selected.manifest.version) > 0
    ) {
      selectedByName.set(bundle.manifest.name, bundle);
    }

    const nextActive = [...active, bundle];
    for (const [index, dependency] of getWorkflowSkillInstallDependencies(bundle).entries()) {
      const memberSource =
        bundle === input.bundle && bundle.manifest.kind === "team"
          ? bundle.manifest.members?.find(
              (source) => source === bundle.manifest.skills[index]?.source,
            )
          : undefined;
      try {
        const child = await resolver.resolve({ dependency, parent: bundle });
        if (!child) {
          continue;
        }
        resolvedChildren.set(`${canonicalId}\n${index}`, child);
        if (child.cleanup) {
          cleanups.push(child.cleanup);
        }
        await discover(child, nextActive);
      } catch (error) {
        if (!memberSource) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to resolve team member ${memberSource}: ${message}`, {
          cause: error,
        });
      }
    }
  };

  try {
    await discover(input.bundle, []);
  } catch (error) {
    await Promise.allSettled(cleanups.map((cleanup) => cleanup()));
    throw error;
  }

  try {
    validateResolvedTeamMembers({
      root: input.bundle,
      resolvedChildren,
      selectedByName,
    });
  } catch (error) {
    await Promise.allSettled(cleanups.map((cleanup) => cleanup()));
    throw error;
  }

  if (
    !input.ignoreLockValidation &&
    input.bundle.lock?.schemaVersion === "0.1" &&
    discovered.size > 1
  ) {
    await Promise.allSettled(cleanups.map((cleanup) => cleanup()));
    throw new Error(
      "Legacy workflow lock 0.1 cannot represent nested workflows; run omniskill lock to regenerate workflow.lock.json",
    );
  }

  const selectedDependencies = new Map<string, WorkflowSkillInstallDependency>();
  const dependencyOrder: string[] = [];
  const workflows: WorkflowDependencyGraphWorkflow[] = [];
  const edges: WorkflowDependencyGraphEdge[] = [];
  const seenWorkflows = new Set<string>();
  const seenEdges = new Set<string>();

  const visit = async (bundle: WorkflowBundle, active: WorkflowBundle[]): Promise<void> => {
    const canonicalId = getCanonicalWorkflowIdentity(bundle);
    const cycleIndex = active.findIndex(
      (candidate) => getCanonicalWorkflowIdentity(candidate) === canonicalId,
    );
    if (cycleIndex >= 0) {
      throw new Error(
        `Workflow dependency cycle: ${[
          ...active.slice(cycleIndex).map(getDisplayWorkflowIdentity),
          getDisplayWorkflowIdentity(bundle),
        ].join(" -> ")}`,
      );
    }
    if (seenWorkflows.has(canonicalId)) {
      return;
    }
    seenWorkflows.add(canonicalId);
    workflows.push({
      id: getDisplayWorkflowIdentity(bundle),
      name: bundle.manifest.name,
      version: bundle.manifest.version,
      source: bundle.source,
    });

    const nextActive = [...active, bundle];
    for (const [index, dependency] of getWorkflowSkillInstallDependencies(bundle).entries()) {
      const discoveredChild = resolvedChildren.get(`${canonicalId}\n${index}`);
      const child = discoveredChild
        ? (selectedByName.get(discoveredChild.manifest.name) ?? discoveredChild)
        : null;
      if (child) {
        const edge = {
          from: getDisplayWorkflowIdentity(bundle),
          to: getDisplayWorkflowIdentity(child),
        };
        const edgeId = `${edge.from}\n${edge.to}`;
        if (!seenEdges.has(edgeId)) {
          seenEdges.add(edgeId);
          edges.push(edge);
        }
        await visit(child, nextActive);
        continue;
      }

      const dependencyId = dependency.source;
      const selectedDependency = selectedDependencies.get(dependencyId);
      if (!selectedDependency) {
        dependencyOrder.push(dependencyId);
        selectedDependencies.set(dependencyId, dependency);
      } else if (isPreferredWorkflowSkillDependency(dependency, selectedDependency)) {
        selectedDependencies.set(dependencyId, dependency);
      }
    }
  };

  try {
    await visit(input.bundle, []);
  } catch (error) {
    await Promise.allSettled(cleanups.map((cleanup) => cleanup()));
    throw error;
  }

  const dependencies = dependencyOrder.flatMap((dependencyId) => {
    const dependency = selectedDependencies.get(dependencyId);
    return dependency ? [dependency] : [];
  });

  if (!input.ignoreLockValidation && input.bundle.lock?.schemaVersion === "0.2") {
    try {
      await validateResolvedTransitiveWorkflowLock({
        lock: input.bundle.lock,
        rootDir: input.bundle.sourceDir,
        workflows,
        edges,
        dependencies,
      });
    } catch (error) {
      await Promise.allSettled(cleanups.map((cleanup) => cleanup()));
      throw error;
    }
  }

  return {
    dependencies,
    displaySources: getWorkflowDependencyDisplaySources(input.bundle, workflows, dependencies),
    workflows,
    edges,
    ...(cleanups.length > 0
      ? { cleanup: async () => Promise.all(cleanups.map((cleanup) => cleanup())).then(() => {}) }
      : {}),
  };
}

function isPreferredWorkflowSkillDependency(
  candidate: WorkflowSkillInstallDependency,
  selected: WorkflowSkillInstallDependency,
): boolean {
  const candidateVersion = getWorkflowSkillDependencySemver(candidate.repo);
  const selectedVersion = getWorkflowSkillDependencySemver(selected.repo);
  if (!candidateVersion) {
    return false;
  }
  if (!selectedVersion) {
    return true;
  }
  return compareWorkflowSemver(candidateVersion, selectedVersion) > 0;
}

function getWorkflowSkillDependencySemver(repo: string | undefined): string | null {
  if (!repo) {
    return null;
  }
  const separatorIndex = repo.lastIndexOf("@");
  if (separatorIndex <= 0 || separatorIndex === repo.length - 1) {
    return null;
  }
  const candidate = repo.slice(separatorIndex + 1);
  return parseWorkflowSemver(candidate) ? candidate : null;
}

function getWorkflowDependencyDisplaySources(
  root: WorkflowBundle,
  workflows: WorkflowDependencyGraphWorkflow[],
  dependencies: WorkflowSkillInstallDependency[],
): string[] {
  if (workflows.length > 1) {
    return dependencies.map((dependency) => dependency.source);
  }
  const rootDependencies = getWorkflowSkillInstallDependencies(root);
  return dependencies.map((dependency) => {
    const index = rootDependencies.findIndex(
      (candidate) => candidate.source === dependency.source && candidate.repo === dependency.repo,
    );
    return root.manifest.skills[index]?.source ?? dependency.source;
  });
}

function assertValidWorkflowSemver(bundle: WorkflowBundle): void {
  if (!parseWorkflowSemver(bundle.manifest.version)) {
    throw new Error(
      `Workflow ${bundle.manifest.name} declares invalid semantic version: ${bundle.manifest.version}`,
    );
  }
}

function compareWorkflowSemver(left: string, right: string): number {
  const leftVersion = parseWorkflowSemver(left);
  const rightVersion = parseWorkflowSemver(right);
  if (!leftVersion || !rightVersion) {
    throw new Error(`Cannot compare invalid workflow semantic versions: ${left}, ${right}`);
  }
  for (const index of [0, 1, 2] as const) {
    const difference = leftVersion.core[index] - rightVersion.core[index];
    if (difference !== 0) {
      return difference;
    }
  }
  if (leftVersion.prerelease === rightVersion.prerelease) {
    return 0;
  }
  if (!leftVersion.prerelease) {
    return 1;
  }
  if (!rightVersion.prerelease) {
    return -1;
  }
  return leftVersion.prerelease.localeCompare(rightVersion.prerelease, undefined, {
    numeric: true,
  });
}

function parseWorkflowSemver(
  version: string,
): { core: [number, number, number]; prerelease: string } | null {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      version,
    );
  if (!match) {
    return null;
  }
  const prerelease = match[4] ?? "";
  const prereleaseIdentifiers = prerelease ? prerelease.split(".") : [];
  if (
    prereleaseIdentifiers.some(
      (identifier) =>
        identifier.length === 0 || (/^\d+$/.test(identifier) && /^0\d+/.test(identifier)),
    )
  ) {
    return null;
  }
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease,
  };
}

function createDefaultWorkflowDependencyResolver(options: {
  lock?: WorkflowLockFile;
  runGitCommand?: WorkflowGitCommandRunner;
  tempDir?: string;
  installedRootDir?: string;
}): WorkflowDependencyResolver {
  return {
    async resolve({ dependency, parent }) {
      if (dependency.source.startsWith("catalog:")) {
        const alias = dependency.source.slice("catalog:".length);
        if (!alias) {
          throw new Error("Catalog workflow dependency must include an alias");
        }
        const lockedCommit = getLockedWorkflowCommit(options.lock, alias);
        return loadWorkflowBundle(alias, {
          cwd: parent.sourceDir,
          ...(options.runGitCommand ? { runGitCommand: options.runGitCommand } : {}),
          ...(options.tempDir ? { tempDir: options.tempDir } : {}),
          ...(lockedCommit ? { commit: lockedCommit } : {}),
        });
      }
      if (dependency.source.startsWith("installed:")) {
        const workflowName = dependency.source.slice("installed:".length);
        if (!workflowName) {
          throw new Error("Installed workflow dependency must include a workflow name");
        }
        if (!options.installedRootDir) {
          throw new Error(
            `Installed workflow dependency requires installedRootDir: ${dependency.source}`,
          );
        }
        const installed = await loadInstalledWorkflowBundle({
          rootDir: options.installedRootDir,
          workflowName,
        });
        const recordedSource = installed.workflow.source;
        return loadWorkflowBundle(
          recordedSource.kind === "local" ? recordedSource.path : recordedSource.url,
          {
            cwd: parent.sourceDir,
            ...(options.runGitCommand ? { runGitCommand: options.runGitCommand } : {}),
            ...(options.tempDir ? { tempDir: options.tempDir } : {}),
            ...(recordedSource.kind === "git" && recordedSource.commit
              ? { commit: recordedSource.commit }
              : {}),
          },
        );
      }
      if (parseGitWorkflowSource(dependency.source)) {
        const lockedCommit = getLockedWorkflowCommit(options.lock, dependency.source);
        return loadWorkflowBundle(dependency.source, {
          cwd: parent.sourceDir,
          ...(options.runGitCommand ? { runGitCommand: options.runGitCommand } : {}),
          ...(options.tempDir ? { tempDir: options.tempDir } : {}),
          ...(lockedCommit ? { commit: lockedCommit } : {}),
        });
      }
      const candidate = isAbsolute(dependency.source)
        ? dependency.source
        : resolve(parent.sourceDir, dependency.source);
      const manifestPath = candidate.endsWith(workflowFileName)
        ? candidate
        : join(candidate, workflowFileName);
      if (!existsSync(manifestPath)) {
        return null;
      }
      return loadWorkflowBundle(candidate, { cwd: parent.sourceDir });
    },
  };
}

function getLockedWorkflowCommit(
  lock: WorkflowLockFile | undefined,
  source: string,
): string | null {
  if (lock?.schemaVersion !== "0.2") {
    return null;
  }
  const locked = lock.workflows.find(
    (workflow) =>
      workflow.source.kind === "git" &&
      (workflow.source.url === source || workflow.name === source),
  );
  return locked?.source.kind === "git" ? locked.source.commit : null;
}

function getCanonicalWorkflowIdentity(bundle: WorkflowBundle): string {
  if (bundle.source.kind === "local") {
    return `local:${resolve(bundle.sourceDir)}`;
  }
  const url = new URL(bundle.source.url);
  url.hash = "";
  return `git:${url.toString()}#${bundle.source.subdirectory ?? ""}@${bundle.source.commit ?? ""}`;
}

function getDisplayWorkflowIdentity(bundle: WorkflowBundle): string {
  return `workflow:${bundle.manifest.name}@${bundle.manifest.version}`;
}

export function createWorkflowLoopMetadata(bundle: WorkflowBundle): WorkflowLoopMetadata | null {
  if (!bundle.manifest.loop) {
    return null;
  }

  const entrySkill = getWorkflowEntrySkill(bundle.manifest);
  if (!entrySkill) {
    throw new Error("Looped workflow entry skill could not be resolved");
  }

  return {
    schemaVersion: "0.1",
    workflow: bundle.manifest.name,
    entrySkill: entrySkill.source,
    loopScript: bundle.manifest.loop.script,
    state: bundle.manifest.loop.state,
    execution: bundle.manifest.loop.execution,
    ...(bundle.manifest.loop.type ? { type: bundle.manifest.loop.type } : {}),
    ...(bundle.manifest.loop.goal ? { goal: bundle.manifest.loop.goal } : {}),
    ...(bundle.manifest.loop.done_when ? { done_when: bundle.manifest.loop.done_when } : {}),
    ...(bundle.manifest.loop.stop_when ? { stop_when: bundle.manifest.loop.stop_when } : {}),
    commands: ["start", "status", "log", "advance", "summary"],
  };
}

export async function getPreparedWorkflowSkillInstallDependencies(input: {
  bundle: WorkflowBundle;
  tempDir?: string;
  runGitCommand?: WorkflowGitCommandRunner;
  installedRootDir?: string;
}): Promise<PreparedWorkflowSkillInstallDependencies> {
  const graph = await resolveWorkflowDependencyGraph({
    bundle: input.bundle,
    ...(input.runGitCommand ? { runGitCommand: input.runGitCommand } : {}),
    ...(input.tempDir ? { tempDir: input.tempDir } : {}),
    ...(input.installedRootDir ? { installedRootDir: input.installedRootDir } : {}),
  });
  const dependencies = graph.dependencies;
  if (!input.bundle.manifest.loop) {
    return {
      dependencies,
      displaySources: graph.displaySources,
      ...(graph.cleanup ? { cleanup: graph.cleanup } : {}),
    };
  }

  const entrySkill = getWorkflowEntrySkill(input.bundle.manifest);
  if (!entrySkill) {
    throw new Error("Looped workflow entry skill could not be resolved");
  }

  const entrySource = resolve(input.bundle.sourceDir, entrySkill.source);
  const entryIndex = dependencies.findIndex((dependency) => dependency.source === entrySource);
  const sourceDependency = dependencies[entryIndex];
  if (!sourceDependency) {
    throw new Error("Looped workflow entry dependency could not be resolved");
  }

  const tempRoot = input.tempDir ?? tmpdir();
  await mkdir(tempRoot, { recursive: true });
  const preparedRoot = await mkdtemp(join(tempRoot, "looped-workflow-entry-"));
  const preparedSkillDir = join(preparedRoot, basename(sourceDependency.source));
  const preparedLoopScriptPath = resolveWorkflowLoopScriptPath({
    sourceDir: preparedSkillDir,
    script: input.bundle.manifest.loop.script,
    requireExists: false,
  });
  const metadata = createWorkflowLoopMetadata(input.bundle);
  if (!metadata) {
    throw new Error("Looped workflow metadata could not be generated");
  }

  await cp(sourceDependency.source, preparedSkillDir, { recursive: true });
  await cp(input.bundle.manifestPath, join(preparedSkillDir, workflowFileName));
  await mkdir(dirname(preparedLoopScriptPath), { recursive: true });
  await writeFile(preparedLoopScriptPath, renderGeneratedWorkflowLoopRunner());
  await writeFile(
    join(preparedSkillDir, "loop.metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );

  const preparedDependencies = dependencies.map((dependency, index) =>
    index === entryIndex ? { ...dependency, source: preparedSkillDir } : dependency,
  );

  return {
    dependencies: preparedDependencies,
    displaySources: graph.displaySources,
    cleanup: async () => {
      await rm(preparedRoot, { recursive: true, force: true });
      await graph.cleanup?.();
    },
  };
}

function renderGeneratedWorkflowLoopRunner(): string {
  return [
    "#!/usr/bin/env node",
    "",
    'import { spawnSync } from "node:child_process";',
    'import { fileURLToPath } from "node:url";',
    "",
    'const workflowJson = fileURLToPath(new URL("./workflow.json", import.meta.url));',
    'const cliCommand = process.env.OMNISKILL_BIN ?? "omniskill";',
    "const [command, ...args] = process.argv.slice(2);",
    "",
    "if (!command) {",
    '  console.error("Usage: node loop.mjs <start|status|log|advance|summary> [options]");',
    "  process.exitCode = 1;",
    "} else {",
    '  const result = spawnSync(cliCommand, ["loop", command, workflowJson, ...args], {',
    '    stdio: "inherit",',
    "  });",
    "",
    "  if (result.error) {",
    '    if (result.error.code === "ENOENT") {',
    '      console.error("Omniskills CLI is required to run loop.mjs. Install or expose omniskill on PATH.");',
    "      process.exitCode = 1;",
    "    } else {",
    "      console.error(result.error.message);",
    "      process.exitCode = 1;",
    "    }",
    '  } else if (typeof result.status === "number") {',
    "    process.exitCode = result.status;",
    "  } else {",
    "    if (result.signal) {",
    '      console.error("omniskill terminated by signal " + result.signal);',
    "    }",
    "    process.exitCode = 1;",
    "  }",
    "}",
    "",
  ].join("\n");
}

function getWorkflowEntrySkill(manifest: WorkflowBundleManifest) {
  return manifest.skills.find((skill) => skill.entry === true) ?? null;
}

function createInstalledWorkflowBundle(
  bundle: WorkflowBundle,
  installArtifacts: WorkflowInstallSkillArtifact[],
): InstalledWorkflowBundle {
  return {
    ...bundle.manifest,
    source: bundle.source,
    ...(installArtifacts.length > 0 ? { installArtifacts } : {}),
  };
}

function flattenInstallArtifacts(
  artifacts: WorkflowInstallSkillArtifact[],
): WorkflowRemovalArtifact[] {
  return artifacts.flatMap((artifact) =>
    isRemovableInstallStatus(artifact.status)
      ? artifact.paths.map((path) => ({
          source: artifact.source,
          skillName: artifact.skillName,
          agent: artifact.agent,
          status: artifact.status,
          path,
        }))
      : [],
  );
}

function isRemovableInstallStatus(status: string): boolean {
  return status === "installed" || status === "updated" || status === "overwritten";
}

function getArtifactPathOwners(workflows: InstalledWorkflowBundle[]): Map<string, string[]> {
  const owners = new Map<string, string[]>();
  for (const workflow of workflows) {
    for (const artifact of workflow.installArtifacts ?? []) {
      for (const path of artifact.paths) {
        const existing = owners.get(path) ?? [];
        existing.push(workflow.name);
        owners.set(path, existing);
      }
    }
  }
  return owners;
}

function inferLegacyRemovalArtifacts(
  workflow: InstalledWorkflowBundle,
  homeDir: string,
  skippedArtifacts: WorkflowRemovalSkippedArtifact[],
): WorkflowRemovalArtifact[] {
  const artifacts: WorkflowRemovalArtifact[] = [];
  for (const skill of workflow.skills) {
    const inferred = inferLegacySkillName(skill.source);
    if (!("skillName" in inferred)) {
      skippedArtifacts.push({ source: skill.source, reason: inferred.reason });
      continue;
    }
    for (const path of getLegacySkillArtifactPaths(homeDir, inferred.skillName)) {
      artifacts.push({
        source: skill.source,
        skillName: inferred.skillName,
        agent: "legacy",
        status: "legacy_inferred",
        path,
      });
    }
  }
  return artifacts;
}

function inferLegacySkillName(source: string): { skillName: string } | { reason: string } {
  if (isLocalWorkflowSkillSource(source)) {
    const skillName = basename(source);
    return skillName ? { skillName } : { reason: "Local skill source has no folder name" };
  }
  if (source === "superpowers:brainstorming") {
    return { skillName: "superpowers-brainstorming" };
  }
  if (source === "superpowers:writing-plans") {
    return { skillName: "superpowers-writing-plans" };
  }
  if (source === "superpowers:verification-before-completion") {
    return { skillName: "superpowers-verification-before-completion" };
  }
  if (source.startsWith("mattpocock:")) {
    const skillName = source.slice("mattpocock:".length).trim();
    return skillName ? { skillName } : { reason: "Matt Pocock skill source has no skill name" };
  }

  const mattPocockGithubPrefix = "github:mattpocock/skills/";
  if (source.startsWith(mattPocockGithubPrefix)) {
    const suffix = source.slice(mattPocockGithubPrefix.length);
    const skillName = suffix.startsWith("skills/") ? suffix.slice("skills/".length) : suffix;
    return skillName ? { skillName } : { reason: "Matt Pocock GitHub source has no skill name" };
  }

  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source)) {
    return { skillName: source };
  }

  return { reason: `Cannot safely infer installed skill name from ${source}` };
}

function getLegacySkillArtifactPaths(homeDir: string, skillName: string): string[] {
  return [
    join(homeDir, ".claude", "skills", skillName),
    join(homeDir, ".agents", "skills", skillName),
    join(homeDir, ".codex", "skills", skillName),
    join(homeDir, ".cursor", "rules", `${skillName}.mdc`),
  ];
}

function validateWorkflowBundleFiles(input: {
  manifest: WorkflowBundleManifest;
  sourceDir: string;
}): void {
  if (!input.manifest.loop) {
    return;
  }

  resolveWorkflowLoopScriptPath({
    sourceDir: input.sourceDir,
    script: input.manifest.loop.script,
    requireExists: false,
  });
}

function resolveWorkflowLoopScriptPath(input: {
  sourceDir: string;
  script: string;
  requireExists: boolean;
}): string {
  if (isAbsolute(input.script)) {
    throw new Error("Workflow loop script must be a relative path");
  }
  if (extname(input.script) !== ".mjs") {
    throw new Error("Workflow loop script must use a .mjs extension");
  }

  const scriptPath = resolve(input.sourceDir, input.script);
  const relativePath = relative(input.sourceDir, scriptPath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error("Workflow loop script must stay inside the workflow bundle");
  }
  if (input.requireExists && !existsSync(scriptPath)) {
    throw new Error(`Workflow loop script was not found: ${scriptPath}`);
  }

  return scriptPath;
}

async function loadWorkflowLockFileForManifest(input: {
  manifest: WorkflowBundleManifest;
  sourceDir: string;
}): Promise<{ lock: WorkflowLockFile; path: string } | null> {
  const path = join(input.sourceDir, workflowLockFileName);
  if (!existsSync(path)) {
    return null;
  }

  const rawLock = await readFile(path, "utf8");
  const lock = WorkflowLockFileSchema.parse(JSON.parse(rawLock));
  validateWorkflowLockFile({ lock, manifest: input.manifest, path });

  return { lock, path };
}

function validateWorkflowLockFile(input: {
  lock: WorkflowLockFile;
  manifest: WorkflowBundleManifest;
  path: string;
}): void {
  const issues: string[] = [];
  if (input.lock.workflow !== input.manifest.name) {
    issues.push(`workflow is ${input.lock.workflow}, expected ${input.manifest.name}`);
  }
  if (input.lock.workflowVersion !== input.manifest.version) {
    issues.push(
      `workflowVersion is ${input.lock.workflowVersion}, expected ${input.manifest.version}`,
    );
  }
  if (input.lock.schemaVersion === "0.1") {
    if (input.lock.skills.length !== input.manifest.skills.length) {
      issues.push(
        `skills length is ${input.lock.skills.length}, expected ${input.manifest.skills.length}`,
      );
    }

    for (const [index, skill] of input.manifest.skills.entries()) {
      const lockedSkill = input.lock.skills[index];
      if (!lockedSkill) {
        continue;
      }
      if (lockedSkill.source !== skill.source) {
        issues.push(`skills[${index}].source is ${lockedSkill.source}, expected ${skill.source}`);
      }
      if (lockedSkill.repo !== skill.repo) {
        issues.push(
          `skills[${index}].repo is ${lockedSkill.repo ?? "<none>"}, expected ${
            skill.repo ?? "<none>"
          }`,
        );
      }
      const expectedKind = isLocalWorkflowSkillSource(skill.source) ? "local" : "external";
      if (lockedSkill.kind !== expectedKind) {
        issues.push(`skills[${index}].kind is ${lockedSkill.kind}, expected ${expectedKind}`);
      }
    }
  } else {
    const rootWorkflow = input.lock.workflows[0];
    if (
      !rootWorkflow ||
      rootWorkflow.name !== input.manifest.name ||
      rootWorkflow.version !== input.manifest.version
    ) {
      issues.push("transitive workflow graph does not start with the manifest workflow");
    }
  }

  if (issues.length > 0) {
    throw new Error(
      `Workflow lock file does not match manifest: ${input.path}\n${issues.join("\n")}`,
    );
  }
}

async function validateResolvedTransitiveWorkflowLock(input: {
  lock: Extract<WorkflowLockFile, { schemaVersion: "0.2" }>;
  rootDir: string;
  workflows: WorkflowDependencyGraphWorkflow[];
  edges: WorkflowDependencyGraphEdge[];
  dependencies: WorkflowSkillInstallDependency[];
}): Promise<void> {
  const resolvedWorkflows = createLockedWorkflowGraph(input.rootDir, input.workflows);
  const lockedWorkflows = input.lock.workflows.map((workflow, index) => ({
    ...workflow,
    source: index === 0 ? validateLockedRootSource(workflow.source) : workflow.source,
  }));
  const resolvedSkills = await createWorkflowLockSkillEntries(input.rootDir, input.dependencies);
  const matches =
    JSON.stringify(lockedWorkflows) === JSON.stringify(resolvedWorkflows) &&
    JSON.stringify(input.lock.edges) === JSON.stringify(input.edges) &&
    JSON.stringify(input.lock.skills) === JSON.stringify(resolvedSkills);
  if (!matches) {
    throw new Error("Transitive workflow lock does not match resolved dependency graph");
  }
}

function validateLockedRootSource(source: z.infer<typeof LockedWorkflowSourceSchema>): {
  kind: "root";
} {
  if (source.kind === "root" || (source.kind === "local" && source.path === ".")) {
    return { kind: "root" };
  }
  throw new Error("Transitive workflow lock has an invalid root source");
}

function createLockedWorkflowGraph(
  rootDir: string,
  workflows: WorkflowDependencyGraphWorkflow[],
): Array<z.infer<typeof WorkflowDependencyGraphWorkflowSchema>> {
  return workflows.map((workflow, index) => ({
    ...workflow,
    source:
      index === 0
        ? { kind: "root" as const }
        : getPortableLockedWorkflowSource(rootDir, workflow.source),
  }));
}

function getPortableLockedWorkflowSource(
  rootDir: string,
  source: WorkflowBundleSource,
): z.infer<typeof LockedWorkflowSourceSchema> {
  if (source.kind === "git") {
    if (!source.commit) {
      throw new Error(`Locked child workflow git source is missing an exact commit: ${source.url}`);
    }
    return { ...source, commit: source.commit };
  }
  return { kind: "local", path: getPortableLocalLockSource(rootDir, source.path) };
}

async function createWorkflowLockSkillEntries(
  rootDir: string,
  dependencies: WorkflowSkillInstallDependency[],
): Promise<WorkflowSkillLockEntry[]> {
  return Promise.all(
    dependencies.map(async (skill) => {
      const isLocal = isAbsolute(skill.source);
      const lockSource = isLocal ? getPortableLocalLockSource(rootDir, skill.source) : skill.source;
      return {
        source: lockSource,
        resolvedName: getWorkflowLockResolvedName(lockSource),
        kind: isLocal ? "local" : "external",
        ...(skill.repo ? { repo: skill.repo } : {}),
        hash: isLocal
          ? await hashLocalWorkflowSkill(skill.source)
          : hashExternalWorkflowSkill(skill.source, skill.repo),
      } satisfies WorkflowSkillLockEntry;
    }),
  );
}

function getPortableLocalLockSource(rootDir: string, source: string): string {
  const relativeSource = normalizeLockPath(relative(rootDir, source));
  if (!relativeSource) {
    return ".";
  }
  return relativeSource.startsWith("..") ? relativeSource : `./${relativeSource}`;
}

function getWorkflowLockResolvedName(source: string): string {
  if (isLocalWorkflowSkillSource(source)) {
    return basename(source);
  }

  const inferred = inferLegacySkillName(source);
  if ("skillName" in inferred) {
    return inferred.skillName;
  }

  return source;
}

async function hashLocalWorkflowSkill(skillDir: string): Promise<string> {
  const files = await listWorkflowSkillFiles(skillDir);
  if (files.length === 0) {
    throw new Error(`Local workflow skill has no files to lock: ${skillDir}`);
  }

  const hash = createHash("sha256");
  hash.update("omniskill-workflow-lock-local-skill-v0.1\n");
  for (const filePath of files) {
    const relativePath = normalizeLockPath(relative(skillDir, filePath));
    const content = await readFile(filePath);
    hash.update(`file:${relativePath}\n`);
    hash.update(`bytes:${content.length}\n`);
    hash.update(content);
    hash.update("\n");
  }

  return `sha256:${hash.digest("hex")}`;
}

async function listWorkflowSkillFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listWorkflowSkillFiles(path)));
      continue;
    }
    if (entry.isFile()) {
      files.push(path);
    }
  }

  return files.sort((left, right) =>
    normalizeLockPath(left).localeCompare(normalizeLockPath(right)),
  );
}

function hashExternalWorkflowSkill(source: string, repo: string | undefined): string {
  const hash = createHash("sha256");
  hash.update("omniskill-workflow-lock-external-skill-v0.1\n");
  hash.update(`source:${source}\n`);
  hash.update(`repo:${repo ?? ""}\n`);
  return `sha256:${hash.digest("hex")}`;
}

function normalizeLockPath(path: string): string {
  return path.split(sep).join("/");
}

function createScaffoldManifest(name: string): WorkflowBundleManifest {
  return WorkflowBundleManifestSchema.parse({
    schemaVersion: "0.1",
    name,
    version: "0.1.0",
    description: `Omniskills workflow for ${name}.`,
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
    `description: "Use when running the ${name} Omniskills workflow, bundle skill, skill tree, or orchestrated multi-skill workflow."`,
    "---",
    "",
    `# ${name} Omniskills`,
    "",
    `This is the entry skill for the ${name} Omniskills workflow.`,
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
    "- The entry skill orchestrates through required instructions; Omniskills installs and validates the dependency skills.",
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

function isLocalWorkflowSkillSource(source: string): boolean {
  return source.startsWith("./") || source.startsWith("../");
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
    commit?: string;
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
    `Unsupported Omniskills source: ${source}. Use a local path, workflow.json path, public git URL, or lowercase workflow alias.`,
  );
}

function parseWorkflowAliasSource(source: string): GitWorkflowSource | null {
  if (!workflowAliasPattern.test(source)) {
    return null;
  }

  const catalogPath = source.endsWith("-team")
    ? canonicalExamplesTeamPath
    : canonicalExamplesWorkflowPath;
  const url = `${canonicalExamplesGitUrl}#${catalogPath}/${source}`;
  const gitSource = parseGitWorkflowSource(url);
  if (!gitSource) {
    throw new Error(`Could not build canonical Omniskills alias URL: ${source}`);
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
    commit?: string;
  },
): Promise<ResolvedWorkflowBundleSource> {
  const tempRoot = await mkdtemp(join(options.tempDir ?? tmpdir(), "omniskill-git-"));
  const checkoutDir = join(tempRoot, "checkout");
  const cleanup = () => rm(tempRoot, { recursive: true, force: true });

  try {
    if (options.commit) {
      for (const command of [
        { args: ["init", checkoutDir], cwd: options.cwd },
        { args: ["remote", "add", "origin", source.cloneUrl], cwd: checkoutDir },
        { args: ["fetch", "--depth", "1", "origin", options.commit], cwd: checkoutDir },
        { args: ["checkout", "--detach", options.commit], cwd: checkoutDir },
      ]) {
        await runRequiredGitCommand(
          { executable: "git", args: command.args, cwd: command.cwd, env: process.env },
          options.runGitCommand,
          `Locked git workflow commit could not be fetched: ${source.url}@${options.commit}`,
        );
      }
    } else {
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
    }

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
    if (options.commit && commit !== options.commit) {
      throw new Error(
        `Locked git workflow commit mismatch: expected ${options.commit}, resolved ${commit ?? "<none>"}`,
      );
    }
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

  return runSubprocess(command);
}

function isMissingFileError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}
