import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { access, appendFile, cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import {
  captureInstructionContext,
  type InstructionContext,
  type InstructionContextFile,
  type InstructionContextGit,
  type InstructionContextSkill,
  shouldCaptureInstructionContext,
} from "./instruction-context";

const snapshotStoreDir = ".getsuperpower";
const snapshotLogFile = "snapshots.jsonl";

export interface SnapshotHistoryInput {
  rootDir: string;
  sessionId?: string | undefined;
}

export interface SnapshotFileState {
  path: string;
  exists: boolean;
  type?: string | undefined;
  stored_copy?: string | undefined;
  sha256?: string | undefined;
}

export interface SnapshotLogEntry {
  snapshot_id: string;
  session_id: string;
  phase: "pre" | "post";
  timestamp_utc: string;
  action?: string | null | undefined;
  purpose?: string | null | undefined;
  reason?: string | null | undefined;
  expected?: string | null | undefined;
  verify?: string | null | undefined;
  rollback?: string | null | undefined;
  summary?: string | null | undefined;
  checks?: string | null | undefined;
  result?: string | null | undefined;
  files: SnapshotFileState[];
  instruction_context?: InstructionContext | undefined;
}

export interface SnapshotHistory {
  logPath: string;
  sessions: SnapshotSession[];
}

export interface SnapshotSession {
  sessionId: string;
  commits: SnapshotCommit[];
}

export interface SnapshotCommit {
  snapshotId: string;
  sessionId: string;
  timestampUtc: string;
  hasPre: boolean;
  hasPost: boolean;
  action?: string | undefined;
  summary?: string | undefined;
  checks?: string | undefined;
  result?: string | undefined;
  rollback?: string | undefined;
  files: SnapshotFileState[];
  instructionContexts: {
    pre?: InstructionContext | undefined;
    post?: InstructionContext | undefined;
  };
}

export type SnapshotRevertAction =
  | {
      type: "restore";
      path: string;
      source: string;
    }
  | {
      type: "delete";
      path: string;
    };

export interface SnapshotRevertPlan {
  rootDir: string;
  snapshotId: string;
  actions: SnapshotRevertAction[];
}

export interface RecordedSnapshotCommit {
  snapshotId: string;
  sessionId: string;
  logPath: string;
  treePath: string;
}

export interface RecordSnapshotPreInput {
  rootDir: string;
  sessionId: string;
  snapshotId?: string | undefined;
  idPrefix?: string | undefined;
  timestampUtc?: string | undefined;
  action: string;
  purpose: string;
  reason: string;
  expected: string;
  verify: string;
  rollback: string;
  files?: SnapshotFileState[] | undefined;
  instructionContext?: boolean | undefined;
}

export interface RecordSnapshotPostInput {
  rootDir: string;
  sessionId: string;
  snapshotId: string;
  timestampUtc?: string | undefined;
  summary: string;
  checks: string;
  result: string;
  files?: SnapshotFileState[] | undefined;
  instructionContext?: boolean | undefined;
}

interface SnapshotPair {
  pre?: SnapshotLogEntry;
  post?: SnapshotLogEntry;
}

export async function recordSnapshotPre(
  input: RecordSnapshotPreInput,
): Promise<RecordedSnapshotCommit> {
  const rootDir = resolve(input.rootDir);
  const timestampUtc = input.timestampUtc ?? new Date().toISOString();
  const snapshotId =
    input.snapshotId ?? createSnapshotId(input.idPrefix ?? "snapshot", timestampUtc);

  const entry: SnapshotLogEntry = {
    snapshot_id: snapshotId,
    session_id: input.sessionId,
    phase: "pre",
    timestamp_utc: timestampUtc,
    action: input.action,
    purpose: input.purpose,
    reason: input.reason,
    expected: input.expected,
    verify: input.verify,
    rollback: input.rollback,
    files: input.files ?? [],
  };

  if (
    shouldCaptureInstructionContext({
      instructionContext: input.instructionContext,
      env: process.env,
    })
  ) {
    entry.instruction_context = await captureInstructionContext({
      rootDir,
      sessionId: input.sessionId,
      timestampUtc,
    });
  }

  return appendSnapshotEntry(rootDir, entry);
}

export async function recordSnapshotPost(
  input: RecordSnapshotPostInput,
): Promise<RecordedSnapshotCommit> {
  const rootDir = resolve(input.rootDir);
  const timestampUtc = input.timestampUtc ?? new Date().toISOString();

  const entry: SnapshotLogEntry = {
    snapshot_id: input.snapshotId,
    session_id: input.sessionId,
    phase: "post",
    timestamp_utc: timestampUtc,
    summary: input.summary,
    checks: input.checks,
    result: input.result,
    files: input.files ?? [],
  };

  if (
    shouldCaptureInstructionContext({
      instructionContext: input.instructionContext,
      env: process.env,
    })
  ) {
    entry.instruction_context = await captureInstructionContext({
      rootDir,
      sessionId: input.sessionId,
      timestampUtc,
    });
  }

  return appendSnapshotEntry(rootDir, entry);
}

export async function readSnapshotHistory(input: SnapshotHistoryInput): Promise<SnapshotHistory> {
  const logPath = getSnapshotLogPath(input.rootDir);
  const entries = await readSnapshotEntries(logPath);
  const pairsBySession = new Map<string, Map<string, SnapshotPair>>();

  for (const entry of entries) {
    if (input.sessionId && entry.session_id !== input.sessionId) {
      continue;
    }

    let sessionPairs = pairsBySession.get(entry.session_id);
    if (!sessionPairs) {
      sessionPairs = new Map();
      pairsBySession.set(entry.session_id, sessionPairs);
    }

    const pair = sessionPairs.get(entry.snapshot_id) ?? {};
    pair[entry.phase] = entry;
    sessionPairs.set(entry.snapshot_id, pair);
  }

  const sessions = Array.from(pairsBySession.entries())
    .map(([sessionId, pairs]) => ({
      sessionId,
      commits: Array.from(pairs.entries())
        .map(([snapshotId, pair]) => toSnapshotCommit(sessionId, snapshotId, pair))
        .sort((left, right) => left.timestampUtc.localeCompare(right.timestampUtc)),
    }))
    .sort((left, right) =>
      (left.commits[0]?.timestampUtc ?? "").localeCompare(right.commits[0]?.timestampUtc ?? ""),
    );

  return { logPath, sessions };
}

export async function planSnapshotRevert(input: {
  rootDir: string;
  snapshotId: string;
}): Promise<SnapshotRevertPlan> {
  const rootDir = resolve(input.rootDir);
  const entries = await readSnapshotEntries(getSnapshotLogPath(rootDir));
  const preEntry = entries.find(
    (entry) => entry.snapshot_id === input.snapshotId && entry.phase === "pre",
  );

  if (!preEntry) {
    throw new Error(`Unknown snapshot: ${input.snapshotId}`);
  }

  const storeDir = join(rootDir, snapshotStoreDir);
  const actions: SnapshotRevertAction[] = [];

  for (const file of preEntry.files) {
    assertSafeRelativePath(rootDir, file.path);

    if (!file.exists) {
      actions.push({ type: "delete", path: file.path });
      continue;
    }

    if (!file.stored_copy) {
      throw new Error(`Missing stored pre snapshot copy for ${file.path}`);
    }

    const source = resolve(storeDir, file.stored_copy);
    assertInside(source, storeDir, `Stored copy escapes snapshot store: ${file.stored_copy}`);

    if (!(await pathExists(source))) {
      throw new Error(`Missing stored pre snapshot copy for ${file.path}`);
    }

    actions.push({ type: "restore", path: file.path, source });
  }

  return {
    rootDir,
    snapshotId: input.snapshotId,
    actions,
  };
}

export async function applySnapshotRevert(plan: SnapshotRevertPlan): Promise<void> {
  for (const action of plan.actions) {
    const target = resolve(plan.rootDir, action.path);
    assertInside(target, plan.rootDir, `Target path escapes workspace: ${action.path}`);

    if (action.type === "restore") {
      await mkdir(dirname(target), { recursive: true });
      await cp(action.source, target);
      continue;
    }

    await rm(target, { recursive: true, force: true });
  }
}

function getSnapshotLogPath(rootDir: string): string {
  return join(rootDir, snapshotStoreDir, snapshotLogFile);
}

async function appendSnapshotEntry(
  rootDir: string,
  entry: SnapshotLogEntry,
): Promise<RecordedSnapshotCommit> {
  assertSafePathSegment(entry.session_id, "session id");

  const logPath = getSnapshotLogPath(rootDir);
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(entry)}\n`);

  const sessionDir = join(rootDir, snapshotStoreDir, "sessions", entry.session_id);
  await mkdir(sessionDir, { recursive: true });
  await appendFile(join(sessionDir, "commits.jsonl"), `${JSON.stringify(entry)}\n`);

  const treePath = join(sessionDir, "tree.md");
  if (!(await pathExists(treePath))) {
    await appendFile(treePath, `# Ponytrail Session Tree\n\nSession: \`${entry.session_id}\`\n`);
  }
  await appendFile(treePath, formatSessionTreeEntry(entry));

  return {
    snapshotId: entry.snapshot_id,
    sessionId: entry.session_id,
    logPath,
    treePath,
  };
}

function formatSessionTreeEntry(entry: SnapshotLogEntry): string {
  const lines = [
    "",
    `## commit ${entry.snapshot_id}`,
    "",
    `- phase: \`${entry.phase}\``,
    `- time: \`${entry.timestamp_utc}\``,
  ];

  appendTreeField(lines, "action", entry.action);
  appendTreeField(lines, "purpose", entry.purpose);
  appendTreeField(lines, "reason", entry.reason);
  appendTreeField(lines, "expected", entry.expected);
  appendTreeField(lines, "verify", entry.verify);
  appendTreeField(lines, "rollback", entry.rollback);
  appendTreeField(lines, "summary", entry.summary);
  appendTreeField(lines, "checks", entry.checks);
  appendTreeField(lines, "result", entry.result);
  lines.push("- files:");

  if (entry.files.length === 0) {
    lines.push("  - none");
  } else {
    for (const file of entry.files) {
      lines.push(formatSessionTreeFile(file));
    }
  }

  if (entry.instruction_context) {
    lines.push("- instruction_context:");
    lines.push(formatInstructionContextTreeLine(entry.instruction_context));
  }

  return `${lines.join("\n")}\n`;
}

function appendTreeField(lines: string[], label: string, value: string | null | undefined): void {
  if (value) {
    lines.push(`- ${label}: ${value}`);
  }
}

function formatSessionTreeFile(file: SnapshotFileState): string {
  if (!file.exists) {
    return `  - \`${file.path}\` missing`;
  }

  const parts = [`  - \`${file.path}\` ${file.type ?? "file"}`];
  if (file.sha256) {
    parts.push(`sha256=\`${file.sha256}\``);
  }
  if (file.stored_copy) {
    parts.push(`stored: \`${file.stored_copy}\``);
  }
  return parts.join(" ");
}

function formatInstructionContextTreeLine(context: InstructionContext): string {
  const capturedFiles = context.files.filter((file) => file.status === "captured").length;
  const capturedSkills = context.skills.filter((skill) => skill.status === "captured").length;
  const warningText =
    context.warnings.length === 0 ? "0 warnings" : `${context.warnings.length} warning(s)`;
  const gitText = [
    context.git.branch ? `branch=${context.git.branch}` : "",
    context.git.commit ? `commit=${context.git.commit}` : "",
    context.git.dirty === undefined ? "" : `dirty=${String(context.git.dirty)}`,
  ]
    .filter(Boolean)
    .join(" ");

  return `  - mode=${context.mode} files=${capturedFiles} skills=${capturedSkills} ${warningText}${
    gitText ? ` ${gitText}` : ""
  }`;
}

function createSnapshotId(prefix: string, timestampUtc: string): string {
  const compactTimestamp = timestampUtc.replace(/\D/g, "").slice(0, 14);
  return `${prefix}-${compactTimestamp}Z-${randomBytes(4).toString("hex")}`;
}

async function readSnapshotEntries(logPath: string): Promise<SnapshotLogEntry[]> {
  let rawLog: string;
  try {
    rawLog = await readFile(logPath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }

  const entries: SnapshotLogEntry[] = [];
  const lines = rawLog.split("\n");
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) {
      continue;
    }

    try {
      entries.push(parseSnapshotEntry(JSON.parse(line), index + 1));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Malformed snapshot log JSON on line ${index + 1}: ${error.message}`);
      }
      throw error;
    }
  }

  return entries;
}

function parseSnapshotEntry(value: unknown, lineNumber: number): SnapshotLogEntry {
  if (!isRecord(value)) {
    throw new Error(`Malformed snapshot log entry on line ${lineNumber}: expected object`);
  }

  const snapshotId = readRequiredString(value, "snapshot_id", lineNumber);
  const sessionId = readRequiredString(value, "session_id", lineNumber);
  const phase = readRequiredString(value, "phase", lineNumber);
  if (phase !== "pre" && phase !== "post") {
    throw new Error(`Malformed snapshot log entry on line ${lineNumber}: invalid phase`);
  }

  const files = value.files;
  if (!Array.isArray(files)) {
    throw new Error(`Malformed snapshot log entry on line ${lineNumber}: files must be an array`);
  }

  return {
    snapshot_id: snapshotId,
    session_id: sessionId,
    phase,
    timestamp_utc: readRequiredString(value, "timestamp_utc", lineNumber),
    action: readOptionalString(value.action),
    purpose: readOptionalString(value.purpose),
    reason: readOptionalString(value.reason),
    expected: readOptionalString(value.expected),
    verify: readOptionalString(value.verify),
    rollback: readOptionalString(value.rollback),
    summary: readOptionalString(value.summary),
    checks: readOptionalString(value.checks),
    result: readOptionalString(value.result),
    files: files.map((file, index) => parseSnapshotFile(file, lineNumber, index)),
    instruction_context: parseInstructionContext(value.instruction_context, lineNumber),
  };
}

function parseSnapshotFile(value: unknown, lineNumber: number, index: number): SnapshotFileState {
  if (!isRecord(value)) {
    throw new Error(
      `Malformed snapshot log entry on line ${lineNumber}: file ${index} must be an object`,
    );
  }

  const exists = value.exists;
  if (typeof exists !== "boolean") {
    throw new Error(
      `Malformed snapshot log entry on line ${lineNumber}: file ${index} exists must be boolean`,
    );
  }

  return {
    path: readRequiredString(value, "path", lineNumber),
    exists,
    type: readOptionalString(value.type),
    stored_copy: readOptionalString(value.stored_copy),
    sha256: readOptionalString(value.sha256),
  };
}

function parseInstructionContext(
  value: unknown,
  lineNumber: number,
): InstructionContext | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(
      `Malformed snapshot log entry on line ${lineNumber}: instruction_context must be an object`,
    );
  }

  const mode = readRequiredString(value, "mode", lineNumber);
  if (mode !== "opt_in") {
    throw new Error(
      `Malformed snapshot log entry on line ${lineNumber}: instruction_context mode is invalid`,
    );
  }

  const files = value.files;
  const skills = value.skills;
  const warnings = value.warnings;
  if (!Array.isArray(files) || !Array.isArray(skills) || !Array.isArray(warnings)) {
    throw new Error(
      `Malformed snapshot log entry on line ${lineNumber}: instruction_context arrays are required`,
    );
  }

  return {
    mode,
    captured_at: readRequiredString(value, "captured_at", lineNumber),
    session_id_hash: readRequiredString(value, "session_id_hash", lineNumber),
    git: parseInstructionContextGit(value.git, lineNumber),
    files: files.map((file, index) => parseInstructionContextFile(file, lineNumber, index)),
    skills: skills.map((skill, index) => parseInstructionContextSkill(skill, lineNumber, index)),
    warnings: warnings.map((warning, index) =>
      readRequiredArrayString(warning, "instruction_context.warnings", lineNumber, index),
    ),
  };
}

function parseInstructionContextGit(value: unknown, lineNumber: number): InstructionContextGit {
  if (!isRecord(value)) {
    throw new Error(
      `Malformed snapshot log entry on line ${lineNumber}: instruction_context.git must be an object`,
    );
  }

  return {
    branch: readOptionalString(value.branch),
    commit: readOptionalString(value.commit),
    dirty: typeof value.dirty === "boolean" ? value.dirty : undefined,
  };
}

function parseInstructionContextFile(
  value: unknown,
  lineNumber: number,
  index: number,
): InstructionContextFile {
  if (!isRecord(value)) {
    throw new Error(
      `Malformed snapshot log entry on line ${lineNumber}: instruction_context.files ${index} must be an object`,
    );
  }

  const status = readRequiredString(value, "status", lineNumber);
  if (!isInstructionContextStatus(status)) {
    throw new Error(
      `Malformed snapshot log entry on line ${lineNumber}: instruction_context.files ${index} has invalid status`,
    );
  }

  return {
    path: readRequiredString(value, "path", lineNumber),
    status,
    sha256: readOptionalString(value.sha256),
    bytes: typeof value.bytes === "number" ? value.bytes : undefined,
  };
}

function parseInstructionContextSkill(
  value: unknown,
  lineNumber: number,
  index: number,
): InstructionContextSkill {
  if (!isRecord(value)) {
    throw new Error(
      `Malformed snapshot log entry on line ${lineNumber}: instruction_context.skills ${index} must be an object`,
    );
  }

  const status = readRequiredString(value, "status", lineNumber);
  if (!isInstructionContextStatus(status)) {
    throw new Error(
      `Malformed snapshot log entry on line ${lineNumber}: instruction_context.skills ${index} has invalid status`,
    );
  }

  return {
    name: readRequiredString(value, "name", lineNumber),
    status,
    path: readOptionalString(value.path),
    version_or_sha256: readOptionalString(value.version_or_sha256),
  };
}

function isInstructionContextStatus(status: string): status is InstructionContextFile["status"] {
  return status === "captured" || status === "missing" || status === "unreadable";
}

function toSnapshotCommit(
  sessionId: string,
  snapshotId: string,
  pair: SnapshotPair,
): SnapshotCommit {
  const pre = pair.pre;
  const post = pair.post;
  const filesByPath = new Map<string, SnapshotFileState>();

  for (const file of [...(pre?.files ?? []), ...(post?.files ?? [])]) {
    if (!filesByPath.has(file.path)) {
      filesByPath.set(file.path, file);
    }
  }

  return {
    snapshotId,
    sessionId,
    timestampUtc: pre?.timestamp_utc ?? post?.timestamp_utc ?? "",
    hasPre: Boolean(pre),
    hasPost: Boolean(post),
    action: pre?.action ?? undefined,
    summary: post?.summary ?? undefined,
    checks: post?.checks ?? undefined,
    result: post?.result ?? undefined,
    rollback: pre?.rollback ?? undefined,
    files: Array.from(filesByPath.values()),
    instructionContexts: {
      pre: pre?.instruction_context,
      post: post?.instruction_context,
    },
  };
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
  lineNumber: number,
): string {
  const field = value[key];
  if (typeof field !== "string" || !field) {
    throw new Error(`Malformed snapshot log entry on line ${lineNumber}: ${key} is required`);
  }
  return field;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function readRequiredArrayString(
  value: unknown,
  field: string,
  lineNumber: number,
  index: number,
): string {
  if (typeof value !== "string" || !value) {
    throw new Error(
      `Malformed snapshot log entry on line ${lineNumber}: ${field} ${index} is required`,
    );
  }
  return value;
}

function assertSafeRelativePath(rootDir: string, path: string): void {
  const target = resolve(rootDir, path);
  assertInside(target, rootDir, `Target path escapes workspace: ${path}`);
}

function assertInside(path: string, rootDir: string, message: string): void {
  const normalizedRoot = resolve(rootDir);
  if (path !== normalizedRoot && !path.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error(message);
  }
}

function assertSafePathSegment(value: string, label: string): void {
  if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\")) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
