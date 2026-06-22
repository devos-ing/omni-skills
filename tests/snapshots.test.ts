import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applySnapshotRevert,
  planSnapshotRevert,
  readSnapshotHistory,
  recordSnapshotPost,
  recordSnapshotPre,
} from "../src/runtimes/ponytrail/snapshots";

describe("snapshot history", () => {
  test("reads snapshot commits grouped by session", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-snapshots-"));

    try {
      await writeSampleSnapshot(rootDir);

      const history = await readSnapshotHistory({ rootDir });

      expect(history.sessions).toHaveLength(1);
      expect(history.sessions[0]?.sessionId).toBe("session-alpha");
      expect(history.sessions[0]?.commits[0]).toMatchObject({
        snapshotId: "snapshot-001",
        hasPre: true,
        hasPost: true,
        action: "edit note",
        summary: "Updated note",
        checks: "bun test",
        result: "pass",
        rollback: "Restore pre snapshot",
      });
      expect(history.sessions[0]?.commits[0]?.files.map((file) => file.path)).toEqual([
        "notes.txt",
        "created.txt",
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("returns an empty history when the snapshot log is missing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-snapshots-"));

    try {
      const history = await readSnapshotHistory({ rootDir });

      expect(history.sessions).toEqual([]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("records and reads instruction context for pre and post phases", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-snapshots-"));

    try {
      await writeFile(join(rootDir, "AGENTS.md"), "agent rules\n");
      const pre = await recordSnapshotPre({
        rootDir,
        sessionId: "session-alpha",
        snapshotId: "snapshot-context-001",
        timestampUtc: "2026-06-22T17:04:23Z",
        action: "edit note",
        purpose: "Exercise instruction context",
        reason: "Snapshots should explain active rules without storing content",
        expected: "Instruction context hashes are present",
        verify: "bun test tests/snapshots.test.ts",
        rollback: "Restore pre snapshot",
        instructionContext: true,
      });

      await writeFile(join(rootDir, "AGENTS.md"), "agent rules changed\n");
      await recordSnapshotPost({
        rootDir,
        sessionId: pre.sessionId,
        snapshotId: pre.snapshotId,
        timestampUtc: "2026-06-22T17:05:23Z",
        summary: "Updated note",
        checks: "bun test",
        result: "pass",
        instructionContext: true,
      });

      const history = await readSnapshotHistory({ rootDir });
      const commit = history.sessions[0]?.commits[0];

      expect(
        commit?.instructionContexts.pre?.files.find((file) => file.path === "AGENTS.md"),
      ).toMatchObject({ status: "captured", bytes: 12 });
      expect(
        commit?.instructionContexts.post?.files.find((file) => file.path === "AGENTS.md"),
      ).toMatchObject({ status: "captured", bytes: 20 });
      expect(
        commit?.instructionContexts.pre?.files.find((file) => file.path === "AGENTS.md")?.sha256,
      ).not.toBe(
        commit?.instructionContexts.post?.files.find((file) => file.path === "AGENTS.md")?.sha256,
      );

      const rawEntries = (await readFile(join(rootDir, ".pony-trail", "snapshots.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(rawEntries[0].instruction_context.mode).toBe("opt_in");
      expect(JSON.stringify(rawEntries[0].instruction_context)).not.toContain("agent rules");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("plans and applies a revert from a pre snapshot", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-snapshots-"));

    try {
      await writeSampleSnapshot(rootDir);
      await writeFile(join(rootDir, "notes.txt"), "after\n");
      await writeFile(join(rootDir, "created.txt"), "created\n");

      const plan = await planSnapshotRevert({ rootDir, snapshotId: "snapshot-001" });

      expect(plan.actions).toEqual([
        {
          type: "restore",
          path: "notes.txt",
          source: join(rootDir, ".pony-trail", "files", "snapshot-001", "pre", "notes.txt"),
        },
        {
          type: "delete",
          path: "created.txt",
        },
      ]);

      await applySnapshotRevert(plan);

      expect(await readFile(join(rootDir, "notes.txt"), "utf8")).toBe("before\n");
      await expect(stat(join(rootDir, "created.txt"))).rejects.toThrow();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("refuses unknown snapshots and missing stored copies", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-snapshots-"));

    try {
      await writeSampleSnapshot(rootDir);

      await expect(planSnapshotRevert({ rootDir, snapshotId: "missing" })).rejects.toThrow(
        "Unknown snapshot: missing",
      );

      await rm(join(rootDir, ".pony-trail", "files"), {
        recursive: true,
        force: true,
      });

      await expect(planSnapshotRevert({ rootDir, snapshotId: "snapshot-001" })).rejects.toThrow(
        "Missing stored pre snapshot copy for notes.txt",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

async function writeSampleSnapshot(rootDir: string): Promise<void> {
  const snapshotDir = join(rootDir, ".pony-trail");
  await mkdir(join(snapshotDir, "files", "snapshot-001", "pre"), { recursive: true });
  await writeFile(join(snapshotDir, "files", "snapshot-001", "pre", "notes.txt"), "before\n");
  await writeFile(
    join(snapshotDir, "snapshots.jsonl"),
    `${[
      JSON.stringify({
        snapshot_id: "snapshot-001",
        session_id: "session-alpha",
        phase: "pre",
        timestamp_utc: "2026-06-21T13:00:00Z",
        action: "edit note",
        purpose: "Exercise shell helper",
        reason: "The skill should work without Python",
        expected: "A pre snapshot is written",
        verify: "Run this test",
        rollback: "Restore pre snapshot",
        files: [
          {
            path: "notes.txt",
            exists: true,
            type: "file",
            stored_copy: "files/snapshot-001/pre/notes.txt",
          },
          {
            path: "created.txt",
            exists: false,
          },
        ],
      }),
      JSON.stringify({
        snapshot_id: "snapshot-001",
        session_id: "session-alpha",
        phase: "post",
        timestamp_utc: "2026-06-21T13:01:00Z",
        summary: "Updated note",
        checks: "bun test",
        result: "pass",
        files: [
          {
            path: "notes.txt",
            exists: true,
            type: "file",
            stored_copy: "files/snapshot-001/post/notes.txt",
          },
          {
            path: "created.txt",
            exists: true,
            type: "file",
          },
        ],
      }),
    ].join("\n")}\n`,
  );
}
