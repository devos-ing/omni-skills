import { constants } from "node:fs";
import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

const snapshotStoreDir = ".agent-change-snapshots";
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

interface SnapshotPair {
  pre?: SnapshotLogEntry;
  post?: SnapshotLogEntry;
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
