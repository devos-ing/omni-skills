import { constants } from "node:fs";
import { access, chmod, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export type SkillInstallAgent = "claude" | "copilot" | "codex";

export type SkillInstallStatus =
  | "installed"
  | "overwritten"
  | "skipped_exists"
  | "would_install"
  | "would_overwrite"
  | "updated"
  | "would_update"
  | "already_present";

export interface ResolvedInstallSkillSource {
  kind: "bundled" | "path";
  name: string;
  path: string;
}

export interface SkillInstallTargetResult {
  agent: SkillInstallAgent;
  destination: string;
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
  installPrehook?: boolean;
}

const DEFAULT_BUNDLED_SKILL = "pony-trail";
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

const agentSkillDirs: Record<SkillInstallAgent, string[]> = {
  claude: [".claude", "skills"],
  copilot: [".agents", "skills"],
  codex: [".codex", "skills"],
};

const prehookScriptName = "ponytrail-prehook.sh";
const prehookMatchers = ["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash"];
const agentPrehookPaths: Record<SkillInstallAgent, { hookDir: string[]; settingsPath: string[] }> =
  {
    claude: { hookDir: [".claude", "hooks"], settingsPath: [".claude", "settings.json"] },
    copilot: { hookDir: [".agents", "hooks"], settingsPath: [".agents", "hooks.json"] },
    codex: { hookDir: [".codex", "hooks"], settingsPath: [".codex", "hooks.json"] },
  };

export async function installAgentSkill(
  input: InstallAgentSkillInput,
): Promise<SkillInstallResult> {
  const source = await resolveInstallSkillSource(
    input.source ?? DEFAULT_BUNDLED_SKILL,
    input.cwd ? { cwd: input.cwd } : {},
  );
  const targets: SkillInstallTargetResult[] = [];
  const prehooks: SkillInstallPrehookResult[] = [];

  for (const agent of input.agents) {
    const destination = join(input.homeDir, ...agentSkillDirs[agent], source.name);
    const exists = await pathExists(destination);
    const status = getInstallStatus({
      exists,
      dryRun: input.dryRun ?? false,
      force: input.force ?? false,
    });

    if (!input.dryRun && status !== "skipped_exists") {
      if (exists) {
        await rm(destination, { recursive: true, force: true });
      }
      await mkdir(dirname(destination), { recursive: true });
      await cp(source.path, destination, { recursive: true });
    }

    targets.push({ agent, destination, status });

    if (input.installPrehook) {
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
  options: { cwd?: string } = {},
): Promise<ResolvedInstallSkillSource> {
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

  if (await pathExists(pathCandidate)) {
    return resolvePathSkill(pathCandidate);
  }

  throw new Error(`Skill source not found: ${sourceOrName}`);
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

export function parseSkillInstallAgents(rawAgents: string): SkillInstallAgent[] {
  const agents = rawAgents
    .split(",")
    .map((agent) => agent.trim())
    .filter(Boolean);

  if (agents.length === 0) {
    throw new Error("At least one agent target is required.");
  }

  for (const agent of agents) {
    if (!isSkillInstallAgent(agent)) {
      throw new Error(`Unknown skill install agent: ${agent}`);
    }
  }

  return agents as SkillInstallAgent[];
}

async function resolvePathSkill(path: string): Promise<ResolvedInstallSkillSource> {
  const stats = await stat(path);
  if (!stats.isDirectory()) {
    throw new Error(`Skill source must be a directory: ${path}`);
  }

  const name = await readSkillName(path);
  return { kind: "path", name, path };
}

async function installAgentSkillPrehook(input: {
  agent: SkillInstallAgent;
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
  const preToolUse = Array.isArray(hooks.PreToolUse) ? [...hooks.PreToolUse] : [];

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
}): SkillInstallStatus {
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
  return agent === "claude" || agent === "copilot" || agent === "codex";
}

function looksLikePath(value: string): boolean {
  return value.startsWith(".") || value.startsWith("~") || value.includes(sep) || isAbsolute(value);
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
