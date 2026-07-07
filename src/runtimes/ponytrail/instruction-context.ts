import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

export type InstructionContextMode = "opt_in";
export type InstructionContextFileStatus = "captured" | "missing" | "unreadable";

export interface InstructionContextFile {
  path: string;
  status: InstructionContextFileStatus;
  sha256?: string | undefined;
  bytes?: number | undefined;
}

export interface InstructionContextSkill {
  name: string;
  status: InstructionContextFileStatus;
  path?: string | undefined;
  version_or_sha256?: string | undefined;
}

export interface InstructionContextGit {
  branch?: string | undefined;
  commit?: string | undefined;
  dirty?: boolean | undefined;
}

export interface InstructionContext {
  mode: InstructionContextMode;
  captured_at: string;
  session_id_hash: string;
  git: InstructionContextGit;
  files: InstructionContextFile[];
  skills: InstructionContextSkill[];
  warnings: string[];
}

export interface CaptureInstructionContextInput {
  rootDir: string;
  sessionId: string;
  timestampUtc?: string | undefined;
  git?: InstructionContextGit | undefined;
}

export interface ShouldCaptureInstructionContextInput {
  instructionContext?: boolean | undefined;
  env?: Record<string, string | undefined> | undefined;
}

const rootInstructionFiles = ["AGENTS.md", "CLAUDE.md"];
const singleInstructionFiles = [".github/copilot-instructions.md"];
const globInstructionDirs = [".cursor/rules"];
const skillMetadataDirs = ["bundled-skills", ".codex/skills", ".agents/skills", ".claude/skills"];

export function shouldCaptureInstructionContext(
  input: ShouldCaptureInstructionContextInput,
): boolean {
  if (input.instructionContext !== undefined) {
    return input.instructionContext;
  }

  const value = input.env?.PONYTRAIL_INSTRUCTION_CONTEXT;
  return value === "1" || value === "true" || value === "yes";
}

export async function captureInstructionContext(
  input: CaptureInstructionContextInput,
): Promise<InstructionContext> {
  const rootDir = resolve(input.rootDir);
  const warnings: string[] = [];
  const files = await captureInstructionFiles(rootDir, warnings);
  const skills = await captureSkillMetadata(rootDir, warnings);

  return {
    mode: "opt_in",
    captured_at: input.timestampUtc ?? new Date().toISOString(),
    session_id_hash: hashString(input.sessionId),
    git: input.git ?? readGitContext(rootDir),
    files,
    skills,
    warnings,
  };
}

async function captureInstructionFiles(
  rootDir: string,
  warnings: string[],
): Promise<InstructionContextFile[]> {
  const candidates = [
    ...rootInstructionFiles,
    ...singleInstructionFiles,
    ...(await discoverFilesUnderDirs(rootDir, globInstructionDirs, warnings)),
  ];
  const unique = Array.from(new Set(candidates)).sort();
  return Promise.all(unique.map((path) => captureFile(rootDir, path, warnings)));
}

async function captureSkillMetadata(
  rootDir: string,
  warnings: string[],
): Promise<InstructionContextSkill[]> {
  const paths = await discoverSkillMetadataPaths(rootDir, warnings);
  const entries = await Promise.all(
    paths.map(async (path): Promise<InstructionContextSkill> => {
      const file = await captureFile(rootDir, path, warnings);
      return {
        name: skillNameFromPath(path),
        status: file.status,
        path,
        version_or_sha256: file.sha256,
      };
    }),
  );

  return entries.sort((left, right) => (left.path ?? "").localeCompare(right.path ?? ""));
}

async function discoverFilesUnderDirs(
  rootDir: string,
  dirs: string[],
  warnings: string[],
): Promise<string[]> {
  const paths: string[] = [];
  for (const dir of dirs) {
    await collectFiles(rootDir, dir, paths, warnings);
  }
  return paths;
}

async function discoverSkillMetadataPaths(rootDir: string, warnings: string[]): Promise<string[]> {
  const paths: string[] = [];
  for (const dir of skillMetadataDirs) {
    await collectFiles(rootDir, dir, paths, warnings, isSkillMetadataPath);
  }
  return Array.from(new Set(paths)).sort();
}

async function collectFiles(
  rootDir: string,
  relativeDir: string,
  paths: string[],
  warnings: string[],
  predicate: (path: string) => boolean = () => true,
): Promise<void> {
  const absoluteDir = resolve(rootDir, relativeDir);
  assertInside(absoluteDir, rootDir, relativeDir);

  let entries: Array<{
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }>;
  try {
    entries = await readdir(absoluteDir, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }
    warnings.push(`${relativeDir} unreadable`);
    return;
  }

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = join(absoluteDir, entry.name);
    const relativePath = toRelativePath(rootDir, absolutePath);
    if (entry.isDirectory()) {
      await collectFiles(rootDir, relativePath, paths, warnings, predicate);
      continue;
    }
    if (entry.isFile() && predicate(relativePath)) {
      paths.push(relativePath);
    }
  }
}

async function captureFile(
  rootDir: string,
  path: string,
  warnings: string[],
): Promise<InstructionContextFile> {
  const absolutePath = resolve(rootDir, path);
  assertInside(absolutePath, rootDir, path);

  try {
    await access(absolutePath, constants.R_OK);
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      warnings.push(`${path} unreadable`);
      return { path, status: "unreadable" };
    }

    const content = await readFile(absolutePath);
    return {
      path,
      status: "captured",
      sha256: hashBuffer(content),
      bytes: content.byteLength,
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return { path, status: "missing" };
    }
    warnings.push(`${path} unreadable`);
    return { path, status: "unreadable" };
  }
}

function readGitContext(rootDir: string): InstructionContextGit {
  const branch = runGit(rootDir, ["branch", "--show-current"]);
  const commit = runGit(rootDir, ["rev-parse", "--short", "HEAD"]);
  const status = runGit(rootDir, ["status", "--porcelain"]);

  return {
    branch: branch || undefined,
    commit: commit || undefined,
    dirty: status === undefined ? undefined : status.length > 0,
  };
}

function runGit(rootDir: string, args: string[]): string | undefined {
  const result = spawnSync("git", args, { cwd: rootDir, env: withoutInheritedGitEnv() });
  if (result.status !== 0) {
    return undefined;
  }
  return result.stdout.toString("utf8").trim();
}

function withoutInheritedGitEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("GIT_")) {
      delete env[key];
    }
  }
  return env;
}

function isSkillMetadataPath(path: string): boolean {
  return path.endsWith("/SKILL.md") || path.endsWith(".yaml") || path.endsWith(".yml");
}

function skillNameFromPath(path: string): string {
  const parts = path.split("/");
  const skillIndex = parts.findIndex((part) => part === "skills" || part === "bundled-skills");
  const skillName = parts[skillIndex + 1];
  if (skillIndex >= 0 && skillName) {
    return skillName;
  }
  return path;
}

function hashString(value: string): string {
  return hashBuffer(Buffer.from(value, "utf8"));
}

function hashBuffer(value: Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function toRelativePath(rootDir: string, absolutePath: string): string {
  return relative(rootDir, absolutePath).split(sep).join("/");
}

function assertInside(path: string, rootDir: string, label: string): void {
  const normalizedRoot = resolve(rootDir);
  if (path !== normalizedRoot && !path.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error(`Instruction context path escapes workspace: ${label}`);
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
