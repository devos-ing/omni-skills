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
const preFileChangeHookPath = join(
  repoRoot,
  "bundled-skills",
  "pony-trail",
  "hooks",
  "pre-file-change.sh",
);

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

      const logPath = join(rootDir, ".agent-change-snapshots", "snapshots.jsonl");
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
        stat(join(rootDir, ".agent-change-snapshots/files", snapshotId, "pre", "notes.txt")),
      ).resolves.toBeTruthy();
      await expect(
        stat(join(rootDir, ".agent-change-snapshots/files", snapshotId, "post", "notes.txt")),
      ).resolves.toBeTruthy();

      const sessionCommitLog = join(
        rootDir,
        ".agent-change-snapshots",
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
        join(rootDir, ".agent-change-snapshots", "sessions", "session-alpha", "tree.md"),
        "utf8",
      );
      expect(sessionTree).toContain("# PonyTrail Session Tree");
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

  test("pre-file-change hook emits pony-trail context", async () => {
    const hook = await execFileAsync("sh", [preFileChangeHookPath]);

    const output = JSON.parse(hook.stdout);
    expect(output.additionalContext).toContain("$pony-trail");
    expect(output.additionalContext).toContain("pre-change snapshot");
    expect(output.systemMessage).toContain("PonyTrail");
  });
});
