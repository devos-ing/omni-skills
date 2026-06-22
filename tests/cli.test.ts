import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProgram, type GoalClarificationPrompter } from "../src/cli";
import type { CliInvocation, CliStreamRunner } from "../src/plugins/adapters";

describe("cli", () => {
  test("registers onboarding, bot listing, goal drafting, and vote commands", () => {
    const program = buildProgram();

    expect(program.name()).toBe("ponytrail");
    expect(program.commands.map((command) => command.name())).toEqual([
      "onboard",
      "bots",
      "goal",
      "vote",
      "stream-goal",
      "history",
      "revert",
      "skills",
    ]);
  });

  test("runs onboarding and manifest-backed commands", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--yes", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir }).parseAsync(["bots"], { from: "user" });

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["goal", "Add", "CSV", "import", "to", "admin", "dashboard", "--json"],
        {
          from: "user",
        },
      );

      await buildProgram({ cwd: rootDir }).parseAsync(
        [
          "vote",
          "--json",
          "--votes",
          JSON.stringify([
            {
              botId: "product_manager_bot",
              vote: "approve",
              confidence: 0.9,
              reason: "Matches intent.",
              requiredChanges: [],
            },
            {
              botId: "project_manager_bot",
              vote: "approve",
              confidence: 0.8,
              reason: "Can be planned.",
              requiredChanges: [],
            },
            {
              botId: "engineer_bot",
              vote: "approve",
              confidence: 0.7,
              reason: "Feasible.",
              requiredChanges: [],
            },
            {
              botId: "testing_bot",
              vote: "amend",
              confidence: 0.6,
              reason: "Needs evidence.",
              requiredChanges: ["Add test output."],
            },
          ]),
        ],
        { from: "user" },
      );

      expect(logs.some((line) => line.includes("Ponytrail onboarding complete"))).toBe(true);
      expect(logs.some((line) => line.includes("product_manager_bot"))).toBe(true);
      expect(logs.some((line) => line.includes("product_manager_model"))).toBe(true);
      expect(
        logs.some((line) => line.includes('"title": "Add CSV import to admin dashboard"')),
      ).toBe(true);
      expect(logs.some((line) => line.includes('"approved": true'))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("onboard prompts for the workspace name and installs the bundled skill", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const promptedDefaults: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({
        cwd: rootDir,
        projectNamePrompter: async (defaultName: string) => {
          promptedDefaults.push(defaultName);
          return "Prompted Workspace";
        },
      }).parseAsync(["onboard", "--home", homeDir], { from: "user" });

      await expect(
        stat(join(homeDir, ".claude", "skills", "pony-trail", "SKILL.md")),
      ).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".agents", "skills", "pony-trail", "SKILL.md")),
      ).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".codex", "skills", "pony-trail", "SKILL.md")),
      ).resolves.toBeTruthy();
      const manifest = JSON.parse(
        await readFile(join(rootDir, ".ponytrail", "manifest.json"), "utf8"),
      );
      expect(manifest.metadata.name).toBe("Prompted Workspace");
      expect(promptedDefaults).toEqual([rootDir.slice(rootDir.lastIndexOf("/") + 1)]);
      expect(logs.some((line) => line.includes("Skill install result"))).toBe(true);
      expect(logs.some((line) => line.includes("Ponytrail onboarding complete"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("prints clarification questions for unclear goal requests in non-interactive mode", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--yes", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir }).parseAsync(["goal", "make", "it", "better"], {
        from: "user",
      });

      expect(logs.some((line) => line.includes("Needs clarification"))).toBe(true);
      expect(logs.some((line) => line.includes("What specific outcome"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("goal prints requirement court discussion and does not stream by default", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const invocations: CliInvocation[] = [];
    const originalLog = console.log;
    const streamRunner: CliStreamRunner = async function* (invocation) {
      invocations.push(invocation);
      yield { type: "start", invocation };
      yield { type: "stdout", chunk: "model started" };
      yield { type: "exit", exitCode: 0 };
    };

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir, streamRunner }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--yes", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir, streamRunner }).parseAsync(
        ["goal", "Add", "CSV", "import", "to", "admin", "dashboard"],
        { from: "user" },
      );

      expect(logs).toContain("Requirement discussion");
      expect(logs.some((line) => line.includes("product_manager_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("project_manager_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("engineer_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("testing_bot: I think"))).toBe(true);
      expect(logs).toContain("Judge summary");
      expect(logs.some((line) => line.includes("Approvals: 4/4"))).toBe(true);
      expect(logs).toContain("Detailed requirement");
      expect(logs.some((line) => line.includes("Title: Add CSV import to admin dashboard"))).toBe(
        true,
      );
      expect(invocations).toEqual([]);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("goal asks for custom clarification answers before requirement court discussion", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const invocations: CliInvocation[] = [];
    const originalLog = console.log;
    const clarificationPrompter: GoalClarificationPrompter = async ({ questions }) => ({
      answers: questions.map((question, index) => ({
        question,
        mode: "custom",
        answer:
          [
            "Create an admin dashboard CSV importer.",
            "Limit scope to the admin dashboard import workflow.",
            "Show passing tests and a successful import smoke result.",
          ][index] ?? "Clarified detail.",
      })),
    });
    const streamRunner: CliStreamRunner = async function* (invocation) {
      invocations.push(invocation);
      yield { type: "start", invocation };
      yield { type: "stdout", chunk: "worker accepted goal" };
      yield { type: "exit", exitCode: 0 };
    };

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir, streamRunner, clarificationPrompter }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--yes", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir, streamRunner, clarificationPrompter }).parseAsync(
        ["goal", "make", "it", "better"],
        { from: "user" },
      );

      expect(logs.some((line) => line.includes("Needs clarification"))).toBe(true);
      expect(logs).toContain("Requirement discussion");
      expect(logs.some((line) => line.includes("engineer_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("Create an admin dashboard CSV importer"))).toBe(
        true,
      );
      expect(invocations).toEqual([]);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("stream-goal remains a compatibility alias for requirement discussion", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const invocations: CliInvocation[] = [];
    const originalLog = console.log;
    const streamRunner: CliStreamRunner = async function* (invocation) {
      invocations.push(invocation);
      yield { type: "start", invocation };
      yield { type: "exit", exitCode: 0 };
    };

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir, streamRunner }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--yes", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir, streamRunner }).parseAsync(
        ["stream-goal", "--worker", "claude", "Review", "checkout", "test", "plan", "evidence"],
        { from: "user" },
      );

      expect(logs).toContain("Requirement discussion");
      expect(logs.some((line) => line.includes("testing_bot: I think"))).toBe(true);
      expect(invocations).toEqual([]);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("skills install dry-runs bundled pony trail skill installation for npx and bunx usage", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: homeDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--dry-run"],
        { from: "user" },
      );

      expect(logs).toContain("Skill install plan");
      expect(logs.some((line) => line.includes("pony-trail"))).toBe(true);
      expect(logs.some((line) => line.includes("claude: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("copilot: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("codex: would install"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install accepts previous bundled skill names as aliases", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      for (const alias of [
        "record-change-evidence",
        "enter-into-evidence",
        "snapshotting-file-changes",
      ]) {
        await buildProgram({ cwd: homeDir }).parseAsync(
          ["skills", "install", alias, "--home", homeDir, "--dry-run"],
          { from: "user" },
        );
      }

      expect(logs).toContain("Skill install plan");
      expect(logs.some((line) => line.includes("pony-trail"))).toBe(true);
      expect(logs.some((line) => line.includes("claude: would install"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install can dry-run prehook installation", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: homeDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--prehook", "--dry-run"],
        { from: "user" },
      );

      expect(logs).toContain("Prehook install plan");
      expect(logs.some((line) => line.includes("claude: would install"))).toBe(true);
      expect(logs.some((line) => line.includes(".claude/hooks/ponytrail"))).toBe(true);
      expect(logs.some((line) => line.includes("codex: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("copilot: would install"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("history supports simple, details, and JSON output", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSampleSnapshotLog(rootDir);

      await buildProgram({ cwd: rootDir }).parseAsync(["history"], { from: "user" });
      const simpleLogs = logs.splice(0);
      await buildProgram({ cwd: rootDir }).parseAsync(["history", "--mode", "details"], {
        from: "user",
      });
      const detailsLogs = logs.splice(0);
      await buildProgram({ cwd: rootDir }).parseAsync(["history", "--json"], { from: "user" });
      const jsonLogs = logs.splice(0);

      expect(simpleLogs.map(stripAnsi)).toEqual(["snapshot-001"]);
      expect(simpleLogs.some((line) => line.includes("snapshot-001"))).toBe(true);
      expect(simpleLogs.some((line) => line.includes("Updated note"))).toBe(false);
      expect(detailsLogs).toContain("Snapshot history");
      expect(detailsLogs.some((line) => line.includes("session-alpha"))).toBe(true);
      expect(detailsLogs.some((line) => line.includes("snapshot-001"))).toBe(true);
      expect(detailsLogs.some((line) => line.includes("Updated note"))).toBe(true);
      expect(jsonLogs.some((line) => line.includes('"sessionId": "session-alpha"'))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("revert dry-run prints planned snapshot actions without mutating files", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSampleSnapshotLog(rootDir);

      await buildProgram({ cwd: rootDir }).parseAsync(["revert", "snapshot-001", "--dry-run"], {
        from: "user",
      });

      expect(logs).toContain("Snapshot revert plan");
      expect(logs.some((line) => line.includes("Would restore notes.txt"))).toBe(true);
      expect(logs.some((line) => line.includes("Would delete created.txt"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

async function writeSampleSnapshotLog(rootDir: string): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const snapshotDir = join(rootDir, ".agent-change-snapshots");
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
        purpose: "Exercise history",
        reason: "Test history tree",
        expected: "A note changes",
        verify: "Run tests",
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

function stripAnsi(value: string): string {
  return value.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "");
}
