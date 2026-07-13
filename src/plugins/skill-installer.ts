import { constants, type Dirent } from "node:fs";
import { access, chmod, cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export type SkillInstallAgent = "claude" | "copilot" | "codex" | "cursor" | "opencode";
type HookCapableSkillInstallAgent = Exclude<SkillInstallAgent, "cursor" | "opencode">;

export type SkillInstallStatus =
  | "installed"
  | "overwritten"
  | "skipped_exists"
  | "would_install"
  | "would_overwrite"
  | "updated"
  | "would_update"
  | "already_present";
export type SkillInstallOperation = "install" | "update";

export interface ResolvedInstallSkillSource {
  kind: "bundled" | "path";
  name: string;
  path: string;
}

export interface SkillInstallTargetResult {
  agent: SkillInstallAgent;
  destination: string;
  artifactPaths: string[];
  status: SkillInstallStatus;
}

export interface SkillInstallPrehookResult {
  agent: SkillInstallAgent;
  hookScript: string;
  settingsPath: string;
  status: SkillInstallStatus;
}

export interface SkillInstallResult {
  skillName: string;
  source: ResolvedInstallSkillSource;
  dryRun: boolean;
  targets: SkillInstallTargetResult[];
  prehooks: SkillInstallPrehookResult[];
}

export interface InstallAgentSkillInput {
  source?: string;
  cwd?: string;
  homeDir: string;
  agents: SkillInstallAgent[];
  dryRun?: boolean;
  force?: boolean;
  operation?: SkillInstallOperation;
  refreshExisting?: boolean;
  installPrehook?: boolean;
}

export interface ResolveInstallSkillSourceOptions {
  cwd?: string | undefined;
  homeDir?: string | undefined;
}

export class MissingSuperpowersSkillError extends Error {
  constructor(input: { displayName: string; source: string }) {
    super(
      `Superpowers ${input.displayName} skill not found. Install or enable the Superpowers plugin, then run: ${formatSuperpowersInstallCommand(input.source)}`,
    );
    this.name = "MissingSuperpowersSkillError";
  }
}

export class MissingMattPocockSkillError extends Error {
  constructor(input: { skillName: string; homeDir?: string | undefined }) {
    const location = input.homeDir ? ` under ${input.homeDir}` : "";
    super(
      `Matt Pocock ${input.skillName} skill not found${location}. Install or refresh Matt Pocock skills with: omniskill skills install mattpocock/skills. Then retry this command. /setup-matt-pocock-skills configures repo metadata after the skills are installed; it does not install ${input.skillName}.`,
    );
    this.name = "MissingMattPocockSkillError";
  }
}

export class MissingInterfaceCraftSkillError extends Error {
  constructor(input: { source: string; skillName: string; homeDir?: string | undefined }) {
    const location = input.homeDir ? ` under ${input.homeDir}` : "";
    super(
      `Interface Craft ${input.skillName} skill not found${location}. Install it from emilkowalski/skills, then retry this command.`,
    );
    this.name = "MissingInterfaceCraftSkillError";
  }
}

const DEFAULT_BUNDLED_SKILL = "creating-bundle-skills";

interface SupportedSuperpowersSkill {
  source: string;
  displayName: string;
  skillFolder: string;
  installName: string;
}

const supportedSuperpowersSkills = [
  {
    source: "superpowers:brainstorming",
    displayName: "brainstorming",
    skillFolder: "brainstorming",
    installName: "superpowers-brainstorming",
  },
  {
    source: "superpowers:writing-plans",
    displayName: "writing-plans",
    skillFolder: "writing-plans",
    installName: "superpowers-writing-plans",
  },
  {
    source: "superpowers:verification-before-completion",
    displayName: "verification-before-completion",
    skillFolder: "verification-before-completion",
    installName: "superpowers-verification-before-completion",
  },
] as const satisfies readonly SupportedSuperpowersSkill[];

const interfaceCraftSkillMappings = [
  {
    canonicalSource: "emilkowalski:emil-design-eng",
    legacySource: "interface-craft:design-engineering",
    installedName: "emil-design-eng",
  },
  {
    canonicalSource: "emilkowalski:animation-vocabulary",
    legacySource: "interface-craft:motion-vocabulary",
    installedName: "animation-vocabulary",
  },
  {
    canonicalSource: "emilkowalski:apple-design",
    legacySource: "interface-craft:fluid-interface-design",
    installedName: "apple-design",
  },
  {
    canonicalSource: "emilkowalski:review-animations",
    legacySource: "interface-craft:motion-review",
    installedName: "review-animations",
  },
] as const;

export function getInterfaceCraftInstalledSkillName(source: string): string | null {
  const mapping = interfaceCraftSkillMappings.find(
    (candidate) => candidate.canonicalSource === source || candidate.legacySource === source,
  );
  return mapping?.installedName ?? null;
}
const bundledSkillAliases: Record<string, string> = {
  "record-change-evidence": "pony-trail",
  "enter-into-evidence": "pony-trail",
  "snapshotting-file-changes": "pony-trail",
};
const moduleDir = dirname(fileURLToPath(import.meta.url));
const bundledSkillsDirCandidates = [
  resolve(moduleDir, "..", "..", "bundled-skills"),
  resolve(moduleDir, "..", "bundled-skills"),
];

const agentSkillTargets: Record<
  SkillInstallAgent,
  { kind: "directory"; path: string[] } | { kind: "cursor_rule"; path: string[] }
> = {
  claude: { kind: "directory", path: [".claude", "skills"] },
  copilot: { kind: "directory", path: [".agents", "skills"] },
  codex: { kind: "directory", path: [".agents", "skills"] },
  cursor: { kind: "cursor_rule", path: [".cursor", "rules"] },
  opencode: { kind: "directory", path: [".agents", "skills"] },
};

const prehookScriptName = "ponytrail-prehook.sh";
const legacyPrehookScriptNames = ["devcourt-record-change-evidence-prehook.sh"];
const prehookMatchers = ["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash"];
const agentPrehookPaths: Record<
  HookCapableSkillInstallAgent,
  { hookDir: string[]; settingsPath: string[] }
> = {
  claude: { hookDir: [".claude", "hooks"], settingsPath: [".claude", "settings.json"] },
  copilot: { hookDir: [".agents", "hooks"], settingsPath: [".agents", "hooks.json"] },
  codex: { hookDir: [".codex", "hooks"], settingsPath: [".codex", "hooks.json"] },
};

export async function installAgentSkill(
  input: InstallAgentSkillInput,
): Promise<SkillInstallResult> {
  const source = await resolveInstallSkillSource(input.source ?? DEFAULT_BUNDLED_SKILL, {
    cwd: input.cwd,
    homeDir: input.homeDir,
  });
  const targets: SkillInstallTargetResult[] = [];
  const prehooks: SkillInstallPrehookResult[] = [];
  const operation = input.operation ?? "install";
  const refreshExisting = operation === "update" || input.refreshExisting === true;
  const handledDestinations = new Map<string, SkillInstallStatus>();

  for (const agent of input.agents) {
    const destination = getSkillDestination(input.homeDir, agent, source.name);
    const mirrorDestinations = getSkillMirrorDestinations(input.homeDir, agent, source.name);
    const artifactPaths = [destination, ...mirrorDestinations];
    const handledStatus = handledDestinations.get(destination);
    if (handledStatus) {
      if (
        !input.dryRun &&
        handledStatus !== "skipped_exists" &&
        handledStatus !== "already_present"
      ) {
        for (const mirrorDestination of mirrorDestinations) {
          await refreshSkillTarget({ agent, source, destination: mirrorDestination });
        }
      }
      targets.push({ agent, destination, artifactPaths, status: handledStatus });
      if (input.installPrehook && hasPrehookSupport(agent)) {
        prehooks.push(
          await installAgentSkillPrehook({
            agent,
            source,
            homeDir: input.homeDir,
            dryRun: input.dryRun ?? false,
          }),
        );
      }
      continue;
    }

    const exists = await pathExists(destination);
    const matchesSource =
      exists && refreshExisting
        ? await skillTargetsMatchSource({
            agent,
            source,
            destinations: [destination, ...mirrorDestinations],
          })
        : false;
    const status = getInstallStatus({
      exists,
      dryRun: input.dryRun ?? false,
      force: input.force ?? false,
      operation,
      refreshExisting,
      matchesSource,
    });

    if (!input.dryRun && status !== "skipped_exists" && status !== "already_present") {
      await refreshSkillTarget({ agent, source, destination });
      for (const mirrorDestination of mirrorDestinations) {
        await refreshSkillTarget({ agent, source, destination: mirrorDestination });
      }
    }

    handledDestinations.set(destination, status);
    targets.push({ agent, destination, artifactPaths, status });

    if (input.installPrehook && hasPrehookSupport(agent)) {
      prehooks.push(
        await installAgentSkillPrehook({
          agent,
          source,
          homeDir: input.homeDir,
          dryRun: input.dryRun ?? false,
        }),
      );
    }
  }

  return {
    skillName: source.name,
    source,
    dryRun: input.dryRun ?? false,
    targets,
    prehooks,
  };
}

export async function resolveInstallSkillSource(
  sourceOrName: string,
  options: ResolveInstallSkillSourceOptions = {},
): Promise<ResolvedInstallSkillSource> {
  const interfaceCraftSkillName = getInterfaceCraftInstalledSkillName(sourceOrName);
  if (interfaceCraftSkillName) {
    const homeDir = options.homeDir ?? process.env.HOME ?? process.cwd();
    const skillPath = await findInstalledSkillPath(homeDir, interfaceCraftSkillName);
    if (!skillPath) {
      throw new MissingInterfaceCraftSkillError({
        source: sourceOrName,
        skillName: interfaceCraftSkillName,
        homeDir,
      });
    }
    return resolvePathSkill(skillPath);
  }

  const mattPocockSkillName = parseMattPocockSkillSource(sourceOrName);
  if (mattPocockSkillName) {
    return resolveMattPocockSkill(mattPocockSkillName, options);
  }

  const superpowersSkill = supportedSuperpowersSkills.find(
    (skill) => skill.source === sourceOrName,
  );
  if (superpowersSkill) {
    return resolveSuperpowersSkill(superpowersSkill, options);
  }

  const cwd = options.cwd ?? process.cwd();
  const pathCandidate = isAbsolute(sourceOrName) ? sourceOrName : resolve(cwd, sourceOrName);

  if (looksLikePath(sourceOrName) && (await pathExists(pathCandidate))) {
    return resolvePathSkill(pathCandidate);
  }

  const bundledName = bundledSkillAliases[sourceOrName] ?? sourceOrName;
  const bundledPath = await resolveBundledSkillPath(bundledName);
  if (bundledPath) {
    const name = await readSkillName(bundledPath);
    return { kind: "bundled", name, path: bundledPath };
  }

  if (!looksLikePath(sourceOrName)) {
    const homeDir = options.homeDir ?? process.env.HOME ?? process.cwd();
    const installedSkillPath = await findInstalledSkillPath(homeDir, sourceOrName);
    if (installedSkillPath) {
      return resolvePathSkill(installedSkillPath);
    }
  }

  if (await pathExists(pathCandidate)) {
    return resolvePathSkill(pathCandidate);
  }

  throw new Error(`Skill source not found: ${sourceOrName}`);
}

async function resolveMattPocockSkill(
  skillName: string,
  options: ResolveInstallSkillSourceOptions,
): Promise<ResolvedInstallSkillSource> {
  const homeDir = options.homeDir ?? process.env.HOME ?? process.cwd();
  const skillPath = await findInstalledSkillPath(homeDir, skillName);

  if (!skillPath) {
    throw new MissingMattPocockSkillError({ skillName, homeDir });
  }

  return resolvePathSkill(skillPath);
}

function parseMattPocockSkillSource(source: string): string | null {
  if (source.startsWith("mattpocock:")) {
    const skillName = source.slice("mattpocock:".length).trim();
    return skillName || null;
  }

  const githubPrefix = "github:mattpocock/skills/";
  if (!source.startsWith(githubPrefix)) {
    return null;
  }

  const suffix = source.slice(githubPrefix.length);
  if (suffix.startsWith("skills/")) {
    return suffix.slice("skills/".length) || null;
  }

  return suffix || null;
}

async function findInstalledSkillPath(homeDir: string, skillName: string): Promise<string | null> {
  const candidates = [
    join(homeDir, ".agents", "skills", skillName),
    join(homeDir, ".codex", "skills", skillName),
    join(homeDir, ".claude", "skills", skillName),
  ];

  for (const candidate of candidates) {
    if (await pathExists(join(candidate, "SKILL.md"))) {
      return candidate;
    }
  }

  return null;
}

async function resolveBundledSkillPath(skillName: string): Promise<string | null> {
  for (const bundledSkillsDir of bundledSkillsDirCandidates) {
    const bundledPath = join(bundledSkillsDir, skillName);
    if (await pathExists(bundledPath)) {
      return bundledPath;
    }
  }

  return null;
}

async function resolveSuperpowersSkill(
  skill: SupportedSuperpowersSkill,
  options: ResolveInstallSkillSourceOptions,
): Promise<ResolvedInstallSkillSource> {
  const homeDir = options.homeDir ?? process.env.HOME ?? process.cwd();
  const skillPath =
    (await findSuperpowersSkillPath(homeDir, skill.skillFolder)) ??
    (await findInstalledSuperpowersSkillPath(homeDir, skill));

  if (!skillPath) {
    throw new MissingSuperpowersSkillError({
      displayName: skill.displayName,
      source: skill.source,
    });
  }

  return {
    kind: "path",
    name: skill.installName,
    path: skillPath,
  };
}

async function findInstalledSuperpowersSkillPath(
  homeDir: string,
  skill: SupportedSuperpowersSkill,
): Promise<string | null> {
  return (
    (await findInstalledSkillPath(homeDir, skill.installName)) ??
    (await findInstalledSkillPath(homeDir, skill.skillFolder))
  );
}

async function findSuperpowersSkillPath(
  homeDir: string,
  skillFolder: string,
): Promise<string | null> {
  const roots = [
    join(homeDir, ".codex", "plugins", "cache", "openai-curated", "superpowers"),
    join(homeDir, ".codex", "plugins", "cache", "openai-curated-remote", "superpowers"),
    join(homeDir, ".codex", "plugins", "cache", "openai-bundled", "superpowers"),
  ];

  for (const root of roots) {
    const skillPath = await findNestedSuperpowersSkillPath(root, skillFolder);
    if (skillPath) {
      return skillPath;
    }
  }

  return null;
}

async function findNestedSuperpowersSkillPath(
  root: string,
  skillFolder: string,
): Promise<string | null> {
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillPath = join(root, entry.name, "skills", skillFolder);
    if (await pathExists(join(skillPath, "SKILL.md"))) {
      return skillPath;
    }
  }

  return null;
}

export function isMissingSuperpowersSkillError(
  error: unknown,
): error is MissingSuperpowersSkillError {
  return error instanceof MissingSuperpowersSkillError;
}

export function parseSkillInstallAgents(rawAgents: string): SkillInstallAgent[] {
  const rawAgentEntries = rawAgents
    .split(",")
    .map((agent) => agent.trim())
    .filter(Boolean);

  if (rawAgentEntries.length === 0) {
    throw new Error("At least one agent target is required.");
  }

  const uniqueAgents: SkillInstallAgent[] = [];
  const seenAgents = new Set<SkillInstallAgent>();

  for (const rawAgent of rawAgentEntries) {
    const agent = normalizeSkillInstallAgent(rawAgent);
    if (!agent) {
      throw new Error(`Unknown skill install agent: ${rawAgent}`);
    }
    if (!seenAgents.has(agent)) {
      seenAgents.add(agent);
      uniqueAgents.push(agent);
    }
  }

  return uniqueAgents;
}

async function resolvePathSkill(path: string): Promise<ResolvedInstallSkillSource> {
  const stats = await stat(path);
  if (!stats.isDirectory()) {
    throw new Error(`Skill source must be a directory: ${path}`);
  }

  const name = await readSkillName(path);
  return { kind: "path", name, path };
}

function getSkillDestination(homeDir: string, agent: SkillInstallAgent, skillName: string): string {
  const target = agentSkillTargets[agent];
  if (target.kind === "cursor_rule") {
    return join(homeDir, ...target.path, `${skillName}.mdc`);
  }

  return join(homeDir, ...target.path, skillName);
}

function getSkillMirrorDestinations(
  homeDir: string,
  agent: SkillInstallAgent,
  skillName: string,
): string[] {
  if (agent !== "codex") {
    return [];
  }
  return [join(homeDir, ".codex", "skills", skillName)];
}

async function installSkillTarget(input: {
  agent: SkillInstallAgent;
  source: ResolvedInstallSkillSource;
  destination: string;
}): Promise<void> {
  const target = agentSkillTargets[input.agent];
  await mkdir(dirname(input.destination), { recursive: true });

  if (target.kind === "cursor_rule") {
    await writeFile(input.destination, await renderCursorRule(input.source));
    return;
  }

  await cp(input.source.path, input.destination, { recursive: true });
}

async function refreshSkillTarget(input: {
  agent: SkillInstallAgent;
  source: ResolvedInstallSkillSource;
  destination: string;
}): Promise<void> {
  if (isSourceDestination(input.source, input.destination)) {
    return;
  }

  if (await pathExists(input.destination)) {
    await rm(input.destination, { recursive: true, force: true });
  }
  await installSkillTarget(input);
}

function isSourceDestination(source: ResolvedInstallSkillSource, destination: string): boolean {
  return resolve(source.path) === resolve(destination);
}

async function skillTargetsMatchSource(input: {
  agent: SkillInstallAgent;
  source: ResolvedInstallSkillSource;
  destinations: string[];
}): Promise<boolean> {
  for (const destination of input.destinations) {
    try {
      const target = agentSkillTargets[input.agent];
      if (target.kind === "cursor_rule") {
        if ((await readFile(destination, "utf8")) !== (await renderCursorRule(input.source))) {
          return false;
        }
        continue;
      }

      if (!(await directoryContentsMatch(input.source.path, destination))) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

async function directoryContentsMatch(sourceDir: string, targetDir: string): Promise<boolean> {
  const [sourceEntries, targetEntries] = await Promise.all([
    readSortedDirectoryEntries(sourceDir),
    readSortedDirectoryEntries(targetDir),
  ]);

  if (sourceEntries.length !== targetEntries.length) {
    return false;
  }

  for (const [index, sourceEntry] of sourceEntries.entries()) {
    const targetEntry = targetEntries[index];
    if (!targetEntry || sourceEntry.name !== targetEntry.name) {
      return false;
    }

    const sourcePath = join(sourceDir, sourceEntry.name);
    const targetPath = join(targetDir, targetEntry.name);
    if (sourceEntry.isDirectory() || targetEntry.isDirectory()) {
      if (!sourceEntry.isDirectory() || !targetEntry.isDirectory()) {
        return false;
      }
      if (!(await directoryContentsMatch(sourcePath, targetPath))) {
        return false;
      }
      continue;
    }

    if (!sourceEntry.isFile() || !targetEntry.isFile()) {
      return false;
    }

    if (!(await fileContentsMatch(sourcePath, targetPath))) {
      return false;
    }
  }

  return true;
}

async function readSortedDirectoryEntries(path: string) {
  return (await readdir(path, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

async function fileContentsMatch(leftPath: string, rightPath: string): Promise<boolean> {
  const [left, right] = await Promise.all([readFile(leftPath), readFile(rightPath)]);
  return left.equals(right);
}

async function renderCursorRule(source: ResolvedInstallSkillSource): Promise<string> {
  const content = await readFile(join(source.path, "SKILL.md"), "utf8");

  return `---\nalwaysApply: true\n---\n\n${content.trim()}\n`;
}

async function installAgentSkillPrehook(input: {
  agent: HookCapableSkillInstallAgent;
  source: ResolvedInstallSkillSource;
  homeDir: string;
  dryRun: boolean;
}): Promise<SkillInstallPrehookResult> {
  const prehookSource = join(input.source.path, "hooks", "pre-file-change.sh");
  if (!(await pathExists(prehookSource))) {
    throw new Error(`Skill does not include a prehook script: ${prehookSource}`);
  }

  const paths = agentPrehookPaths[input.agent];
  const hookScript = join(input.homeDir, ...paths.hookDir, prehookScriptName);
  const settingsPath = join(input.homeDir, ...paths.settingsPath);
  const command = `sh ${shellQuote(hookScript)}`;
  const existingSettings = await readJsonSettings(settingsPath);
  const alreadyConfigured = hasPrehookEntries(existingSettings, command);
  const hookScriptExists = await pathExists(hookScript);
  const status = getPrehookStatus({
    dryRun: input.dryRun,
    hookScriptExists,
    alreadyConfigured,
  });

  if (!input.dryRun) {
    await mkdir(dirname(hookScript), { recursive: true });
    await cp(prehookSource, hookScript);
    await chmod(hookScript, 0o755);

    const mergedSettings = mergePrehookSettings(existingSettings, command);
    await mkdir(dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, `${JSON.stringify(mergedSettings, null, 2)}\n`);
  }

  return {
    agent: input.agent,
    hookScript,
    settingsPath,
    status,
  };
}

async function readJsonSettings(path: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function mergePrehookSettings(
  settings: Record<string, unknown>,
  command: string,
): Record<string, unknown> {
  const merged = { ...settings };
  const hooks =
    merged.hooks && typeof merged.hooks === "object" && !Array.isArray(merged.hooks)
      ? { ...(merged.hooks as Record<string, unknown>) }
      : {};
  const preToolUse = Array.isArray(hooks.PreToolUse)
    ? removeLegacyPrehookEntries(hooks.PreToolUse)
    : [];

  for (const matcher of prehookMatchers) {
    if (!hasHookEntry(preToolUse, matcher, command)) {
      preToolUse.push({
        matcher,
        hooks: [{ type: "command", command }],
      });
    }
  }

  hooks.PreToolUse = preToolUse;
  merged.hooks = hooks;
  return merged;
}

function removeLegacyPrehookEntries(entries: unknown[]): unknown[] {
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [entry];
    }

    const hookEntry = entry as Record<string, unknown>;
    if (!Array.isArray(hookEntry.hooks)) {
      return [entry];
    }

    const hooks = hookEntry.hooks.filter((hook) => !isLegacyPrehookCommand(hook));
    if (hooks.length === 0) {
      return [];
    }
    if (hooks.length === hookEntry.hooks.length) {
      return [entry];
    }
    return [{ ...hookEntry, hooks }];
  });
}

function isLegacyPrehookCommand(hook: unknown): boolean {
  if (!hook || typeof hook !== "object" || Array.isArray(hook)) {
    return false;
  }

  const command = (hook as { command?: unknown }).command;
  return (
    typeof command === "string" &&
    legacyPrehookScriptNames.some((scriptName) => command.includes(scriptName))
  );
}

function hasPrehookEntries(settings: Record<string, unknown>, command: string): boolean {
  const hooks = settings.hooks;
  if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) {
    return false;
  }
  const preToolUse = (hooks as Record<string, unknown>).PreToolUse;
  if (!Array.isArray(preToolUse)) {
    return false;
  }
  return prehookMatchers.every((matcher) => hasHookEntry(preToolUse, matcher, command));
}

function hasHookEntry(entries: unknown[], matcher: string, command: string): boolean {
  return entries.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return false;
    }
    const hookEntry = entry as { matcher?: unknown; hooks?: unknown };
    if (hookEntry.matcher !== matcher || !Array.isArray(hookEntry.hooks)) {
      return false;
    }
    return hookEntry.hooks.some((hook) => {
      if (!hook || typeof hook !== "object" || Array.isArray(hook)) {
        return false;
      }
      return (hook as { type?: unknown; command?: unknown }).command === command;
    });
  });
}

async function readSkillName(skillDir: string): Promise<string> {
  const skillPath = join(skillDir, "SKILL.md");
  const content = await readFile(skillPath, "utf8");
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) {
    throw new Error(`Skill is missing YAML frontmatter: ${skillPath}`);
  }
  const frontmatterBody = frontmatter[1];
  if (!frontmatterBody) {
    throw new Error(`Skill is missing YAML frontmatter body: ${skillPath}`);
  }

  const name = frontmatterBody.match(/^name:\s*([a-z0-9-]+)\s*$/m)?.[1];
  if (!name) {
    throw new Error(`Skill frontmatter must include a hyphen-case name: ${skillPath}`);
  }

  const description = frontmatterBody.match(/^description:\s*(.+)\s*$/m)?.[1];
  if (!description) {
    throw new Error(`Skill frontmatter must include a description: ${skillPath}`);
  }

  return name;
}

function getInstallStatus(input: {
  exists: boolean;
  dryRun: boolean;
  force: boolean;
  operation: SkillInstallOperation;
  refreshExisting: boolean;
  matchesSource: boolean;
}): SkillInstallStatus {
  if (input.operation === "update" || input.refreshExisting) {
    if (input.dryRun && input.exists) {
      return input.matchesSource ? "already_present" : "would_update";
    }
    if (input.dryRun) {
      return "would_install";
    }
    if (input.exists) {
      return input.matchesSource ? "already_present" : "updated";
    }
    return "installed";
  }

  if (input.dryRun && input.exists) {
    return "would_overwrite";
  }
  if (input.dryRun) {
    return "would_install";
  }
  if (input.exists && input.force) {
    return "overwritten";
  }
  if (input.exists) {
    return "skipped_exists";
  }
  return "installed";
}

function getPrehookStatus(input: {
  dryRun: boolean;
  hookScriptExists: boolean;
  alreadyConfigured: boolean;
}): SkillInstallStatus {
  if (input.dryRun && (input.hookScriptExists || input.alreadyConfigured)) {
    return "would_update";
  }
  if (input.dryRun) {
    return "would_install";
  }
  if (input.hookScriptExists || input.alreadyConfigured) {
    return input.alreadyConfigured ? "already_present" : "updated";
  }
  return "installed";
}

function isSkillInstallAgent(agent: string): agent is SkillInstallAgent {
  return (
    agent === "claude" ||
    agent === "copilot" ||
    agent === "codex" ||
    agent === "cursor" ||
    agent === "opencode"
  );
}

function normalizeSkillInstallAgent(agent: string): SkillInstallAgent | null {
  const normalized = agent.toLowerCase();
  const aliases: Record<string, SkillInstallAgent> = {
    "github copilot": "copilot",
    "github-copilot": "copilot",
    githubcopilot: "copilot",
    github_copilot: "copilot",
    "open codex": "opencode",
    "open-codex": "opencode",
    opencodex: "opencode",
  };
  const canonical = aliases[normalized] ?? normalized;

  return isSkillInstallAgent(canonical) ? canonical : null;
}

function hasPrehookSupport(agent: SkillInstallAgent): agent is HookCapableSkillInstallAgent {
  return agent !== "cursor" && agent !== "opencode";
}

function looksLikePath(value: string): boolean {
  return value.startsWith(".") || value.startsWith("~") || value.includes(sep) || isAbsolute(value);
}

function formatSuperpowersInstallCommand(source: string): string {
  return `omniskill skills install ${source} --agents codex,claude,cursor,copilot,opencode --home ~`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
