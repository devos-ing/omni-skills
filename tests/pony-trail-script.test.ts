import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shellHelperPath = join(
  repoRoot,
  "bundled-skills",
  "pony-trail",
  "scripts",
  "snapshot_change.sh",
);
const pythonHelperPath = join(
  repoRoot,
  "bundled-skills",
  "pony-trail",
  "scripts",
  "snapshot_change.py",
);
const preFileChangeHookPath = join(
  repoRoot,
  "bundled-skills",
  "pony-trail",
  "hooks",
  "pre-file-change.sh",
);

interface ScriptInstructionContextFile {
  path: string;
  status: string;
  sha256?: string | undefined;
  bytes?: number | undefined;
}

interface ScriptInstructionContextSkill {
  name: string;
  status: string;
  version_or_sha256?: string | undefined;
}

interface ScriptInstructionContext {
  mode: string;
  session_id_hash: string;
  files: ScriptInstructionContextFile[];
  skills: ScriptInstructionContextSkill[];
  warnings: string[];
}

interface ScriptSnapshotEntry {
  snapshot_id: string;
  session_id?: string | undefined;
  instruction_context?: ScriptInstructionContext | undefined;
}

describe("pony-trail shell helper", () => {
  test("records pre and post snapshots without requiring Python", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "pony-trail-sh-"));
    const snapshotId = "shell-helper-test-001";
    const targetFile = join(rootDir, "notes.txt");

    try {
      await writeFile(targetFile, "before\n");

      const pre = await execFileAsync("sh", [
        shellHelperPath,
        "--root",
        rootDir,
        "--session-id",
        "session-alpha",
        "pre",
        "--snapshot-id",
        snapshotId,
        "--files",
        "notes.txt",
        "--action",
        "edit note",
        "--purpose",
        "Exercise shell helper",
        "--reason",
        "The skill should work without Python",
        "--expected",
        "A pre snapshot is written",
        "--verify",
        "Run this test",
        "--rollback",
        "Restore the stored pre snapshot",
      ]);

      expect(JSON.parse(pre.stdout)).toMatchObject({
        snapshot_id: snapshotId,
        files: 1,
      });

      await writeFile(targetFile, "after\n");

      const post = await execFileAsync("sh", [
        shellHelperPath,
        "--root",
        rootDir,
        "--session-id",
        "session-alpha",
        "post",
        "--snapshot-id",
        snapshotId,
        "--files",
        "notes.txt",
        "--summary",
        "Updated test note",
        "--checks",
        "bun test tests/pony-trail-script.test.ts",
        "--result",
        "pass",
      ]);

      expect(JSON.parse(post.stdout)).toMatchObject({
        snapshot_id: snapshotId,
        files: 1,
      });

      const logPath = join(rootDir, ".pony-trail", "snapshots.jsonl");
      const entries = (await readFile(logPath, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      expect(entries.map((entry) => entry.phase)).toEqual(["pre", "post"]);
      expect(entries.map((entry) => entry.session_id)).toEqual(["session-alpha", "session-alpha"]);
      expect(entries[0]).toMatchObject({
        action: "edit note",
        files: [
          {
            path: "notes.txt",
            exists: true,
            type: "file",
          },
        ],
      });
      expect(entries[0].files[0].sha256).toBeString();
      expect(entries[0].files[0].stored_copy).toBe("files/shell-helper-test-001/pre/notes.txt");
      expect(entries[1]).toMatchObject({
        summary: "Updated test note",
        result: "pass",
        files: [
          {
            path: "notes.txt",
            exists: true,
            type: "file",
          },
        ],
      });
      await expect(
        stat(join(rootDir, ".pony-trail/files", snapshotId, "pre", "notes.txt")),
      ).resolves.toBeTruthy();
      await expect(
        stat(join(rootDir, ".pony-trail/files", snapshotId, "post", "notes.txt")),
      ).resolves.toBeTruthy();

      const sessionCommitLog = join(
        rootDir,
        ".pony-trail",
        "sessions",
        "session-alpha",
        "commits.jsonl",
      );
      const sessionCommits = (await readFile(sessionCommitLog, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(sessionCommits.map((commit) => commit.snapshot_id)).toEqual([snapshotId, snapshotId]);
      expect(sessionCommits.map((commit) => commit.phase)).toEqual(["pre", "post"]);

      const sessionTree = await readFile(
        join(rootDir, ".pony-trail", "sessions", "session-alpha", "tree.md"),
        "utf8",
      );
      expect(sessionTree).toContain("# Ponytrail Session Tree");
      expect(sessionTree).toContain("Session: `session-alpha`");
      expect(sessionTree).toContain("## commit shell-helper-test-001");
      expect(sessionTree).toContain("- phase: `pre`");
      expect(sessionTree).toContain("- action: edit note");
      expect(sessionTree).toContain("- rollback: Restore the stored pre snapshot");
      expect(sessionTree).toContain("  - `notes.txt` file");
      expect(sessionTree).toContain("stored: `files/shell-helper-test-001/pre/notes.txt`");
      expect(sessionTree).toContain("- phase: `post`");
      expect(sessionTree).toContain("- summary: Updated test note");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("captures instruction context only when opted in", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "pony-trail-sh-"));
    const snapshotId = "shell-helper-context-001";
    const targetFile = join(rootDir, "notes.txt");

    try {
      await writeFile(targetFile, "before\n");
      await writeFile(join(rootDir, "AGENTS.md"), "agent rules\n");

      await execFileAsync("sh", [
        shellHelperPath,
        "--root",
        rootDir,
        "--session-id",
        "session-alpha",
        "pre",
        "--snapshot-id",
        `${snapshotId}-default`,
        "--files",
        "notes.txt",
        "--action",
        "edit note",
        "--purpose",
        "Exercise default privacy boundary",
        "--reason",
        "The helper should not capture instructions by default",
        "--expected",
        "No instruction context is written",
        "--verify",
        "Run this test",
        "--rollback",
        "Restore the stored pre snapshot",
      ]);

      await execFileAsync("sh", [
        shellHelperPath,
        "--root",
        rootDir,
        "--session-id",
        "session-alpha",
        "--instruction-context",
        "pre",
        "--snapshot-id",
        snapshotId,
        "--files",
        "notes.txt",
        "--action",
        "edit note",
        "--purpose",
        "Exercise instruction context",
        "--reason",
        "The helper should hash instructions when opted in",
        "--expected",
        "Instruction context is written",
        "--verify",
        "Run this test",
        "--rollback",
        "Restore the stored pre snapshot",
      ]);

      const entries = (await readFile(join(rootDir, ".pony-trail", "snapshots.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line): ScriptSnapshotEntry => JSON.parse(line));
      const defaultEntry = entries.find((entry) => entry.snapshot_id === `${snapshotId}-default`);
      const contextEntry = entries.find((entry) => entry.snapshot_id === snapshotId);
      if (!defaultEntry || !contextEntry?.instruction_context) {
        throw new Error("Expected shell helper instruction context entries");
      }
      const agentsFile = contextEntry.instruction_context.files.find(
        (file) => file.path === "AGENTS.md",
      );
      const claudeFile = contextEntry.instruction_context.files.find(
        (file) => file.path === "CLAUDE.md",
      );
      const ponyTrailSkill = contextEntry.instruction_context.skills.find(
        (skill) => skill.name === "pony-trail",
      );
      if (!agentsFile) {
        throw new Error("Expected AGENTS.md in shell helper instruction context");
      }
      if (!ponyTrailSkill) {
        throw new Error("Expected pony-trail skill metadata in shell helper instruction context");
      }

      expect(defaultEntry.instruction_context).toBeUndefined();
      expect(contextEntry.instruction_context).toMatchObject({
        mode: "opt_in",
        warnings: [],
      });
      expect(contextEntry.instruction_context.session_id_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(agentsFile).toMatchObject({
        path: "AGENTS.md",
        status: "captured",
        bytes: 12,
      });
      expect(agentsFile.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(claudeFile).toEqual({ path: "CLAUDE.md", status: "missing" });
      expect(ponyTrailSkill).toMatchObject({
        name: "pony-trail",
        status: "captured",
      });
      expect(ponyTrailSkill.version_or_sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(JSON.stringify(contextEntry.instruction_context)).not.toContain("agent rules");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("python fallback captures schema-compatible instruction context when available", async () => {
    if (!(await hasPython3())) {
      return;
    }

    const rootDir = await mkdtemp(join(tmpdir(), "pony-trail-py-"));

    try {
      await writeFile(join(rootDir, "notes.txt"), "before\n");
      await writeFile(join(rootDir, "AGENTS.md"), "agent rules\n");

      await execFileAsync("python3", [
        pythonHelperPath,
        "--root",
        rootDir,
        "--session-id",
        "session-alpha",
        "--instruction-context",
        "pre",
        "--snapshot-id",
        "python-context-001",
        "--files",
        "notes.txt",
        "--action",
        "edit note",
        "--purpose",
        "Exercise Python helper",
        "--reason",
        "Python fallback should match the shell schema",
        "--expected",
        "Instruction context is written",
        "--verify",
        "Run this test",
        "--rollback",
        "Restore the stored pre snapshot",
      ]);

      const entry = JSON.parse(
        (await readFile(join(rootDir, ".pony-trail", "snapshots.jsonl"), "utf8")).trim(),
      ) as ScriptSnapshotEntry;
      if (!entry.instruction_context) {
        throw new Error("Expected Python helper instruction context");
      }
      const agentsFile = entry.instruction_context.files.find((file) => file.path === "AGENTS.md");
      const ponyTrailSkill = entry.instruction_context.skills.find(
        (skill) => skill.name === "pony-trail",
      );
      if (!agentsFile) {
        throw new Error("Expected AGENTS.md in Python helper instruction context");
      }
      if (!ponyTrailSkill) {
        throw new Error("Expected pony-trail skill metadata in Python helper instruction context");
      }

      expect(entry.session_id).toBe("session-alpha");
      expect(entry.instruction_context.mode).toBe("opt_in");
      expect(entry.instruction_context.session_id_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(agentsFile).toMatchObject({
        path: "AGENTS.md",
        status: "captured",
        bytes: 12,
      });
      expect(agentsFile.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(ponyTrailSkill.status).toBe("captured");
      expect(ponyTrailSkill.version_or_sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(JSON.stringify(entry.instruction_context)).not.toContain("agent rules");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("pre-file-change hook emits pony-trail context", async () => {
    const hook = await execFileAsync("sh", [preFileChangeHookPath]);

    const output = JSON.parse(hook.stdout);
    expect(output.additionalContext).toContain("$pony-trail");
    expect(output.additionalContext).toContain("pre-change snapshot");
    expect(output.systemMessage).toContain("Ponytrail");
  });
});

async function hasPython3(): Promise<boolean> {
  try {
    await execFileAsync("python3", ["--version"]);
    return true;
  } catch {
    return false;
  }
}
