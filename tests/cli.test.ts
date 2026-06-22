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

    const onboardCommand = program.commands.find((command) => command.name() === "onboard");
    const revertCommand = program.commands.find((command) => command.name() === "revert");

    expect(onboardCommand?.options.map((option) => option.long)).toEqual([
      "--dir",
      "--name",
      "--agents",
      "--home",
    ]);
    expect(revertCommand?.options.map((option) => option.long)).toEqual(["--dry-run"]);
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
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
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
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
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
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir, streamRunner }).parseAsync(
        ["goal", "Add", "CSV", "import", "to", "admin", "dashboard"],
        { from: "user" },
      );

      expect(stripAnsiLines(logs)).toContain("Requirement discussion");
      expect(logs.some((line) => line.includes("product_manager_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("project_manager_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("engineer_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("testing_bot: I think"))).toBe(true);
      expect(stripAnsiLines(logs)).toContain("Judge summary");
      expect(logs.some((line) => line.includes("Approvals: 4/4"))).toBe(true);
      expect(stripAnsiLines(logs)).toContain("Detailed requirement");
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
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir, streamRunner, clarificationPrompter }).parseAsync(
        ["goal", "make", "it", "better"],
        { from: "user" },
      );

      expect(logs.some((line) => line.includes("Needs clarification"))).toBe(true);
      expect(stripAnsiLines(logs)).toContain("Requirement discussion");
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
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir, streamRunner }).parseAsync(
        ["stream-goal", "--worker", "claude", "Review", "checkout", "test", "plan", "evidence"],
        { from: "user" },
      );

      expect(stripAnsiLines(logs)).toContain("Requirement discussion");
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

      expect(stripAnsiLines(logs)).toContain("Skill install plan");
      expect(logs.some((line) => line.includes("pony-trail"))).toBe(true);
      expect(logs.some((line) => line.includes("claude: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("copilot: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("codex: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("cursor: would install"))).toBe(true);
      expect(logs.some((line) => line.includes(".cursor/rules/pony-trail.mdc"))).toBe(true);
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

      expect(stripAnsiLines(logs)).toContain("Skill install plan");
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

      expect(stripAnsiLines(logs)).toContain("Prehook install plan");
      expect(logs.some((line) => line.includes("claude: would install"))).toBe(true);
      expect(logs.some((line) => line.includes(".claude/hooks/ponytrail"))).toBe(true);
      expect(logs.some((line) => line.includes("codex: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("copilot: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("cursor: would install"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install records a local project history commit", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );

      await expect(
        stat(join(homeDir, ".codex", "skills", "pony-trail", "SKILL.md")),
      ).resolves.toBeTruthy();
      expect(logs.some((line) => line.includes("Local history:"))).toBe(true);

      await buildProgram({ cwd: rootDir }).parseAsync(["history", "--details"], { from: "user" });
      const historyLogs = logs.splice(0).map(stripAnsi);

      expect(historyLogs.some((line) => line.includes("ponytrail-skills"))).toBe(true);
      expect(historyLogs.some((line) => line.includes("action: install skill"))).toBe(true);
      expect(
        historyLogs.some((line) => line.includes("summary: Installed pony-trail skill for codex")),
      ).toBe(true);

      const entries = (await readFile(join(rootDir, ".pony-trail", "snapshots.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(entries.map((entry) => entry.phase)).toEqual(["pre", "post"]);
      expect(entries.map((entry) => entry.session_id)).toEqual([
        "ponytrail-skills",
        "ponytrail-skills",
      ]);
      expect(entries[0].snapshot_id).toStartWith("skill-install-");

      const sessionTree = await readFile(
        join(rootDir, ".pony-trail", "sessions", "ponytrail-skills", "tree.md"),
        "utf8",
      );
      expect(sessionTree).toContain("Session: `ponytrail-skills`");
      expect(sessionTree).toContain("## commit skill-install-");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("history supports tree, details, and JSON output", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSampleSnapshotLog(rootDir);

      await buildProgram({ cwd: rootDir }).parseAsync(["history"], { from: "user" });
      const treeLogs = logs.splice(0).map(stripAnsi);
      await buildProgram({ cwd: rootDir }).parseAsync(["history", "--details"], { from: "user" });
      const detailsLogs = logs.splice(0).map(stripAnsi);
      await buildProgram({ cwd: rootDir }).parseAsync(["history", "--json"], { from: "user" });
      const jsonLogs = logs.splice(0);

      expect(treeLogs).toEqual([
        "Snapshot history",
        "* session-alpha",
        "  * snapshot-001 (pre/post)",
      ]);
      expect(treeLogs.some((line) => line.includes("Updated note"))).toBe(false);
      expect(treeLogs.some((line) => line.includes("instruction_context"))).toBe(false);
      expect(detailsLogs).toContain("Snapshot history");
      expect(detailsLogs.some((line) => line.includes("session-alpha"))).toBe(true);
      expect(detailsLogs.some((line) => line.includes("snapshot-001"))).toBe(true);
      expect(detailsLogs.some((line) => line.includes("Updated note"))).toBe(true);
      expect(detailsLogs.some((line) => line.includes("instruction_context: pre"))).toBe(true);
      expect(detailsLogs.some((line) => line.includes("AGENTS.md captured sha256:aaaaaaaa"))).toBe(
        true,
      );
      expect(detailsLogs.some((line) => line.includes("git: main abc123 dirty"))).toBe(true);
      expect(jsonLogs.some((line) => line.includes('"sessionId": "session-alpha"'))).toBe(true);
      expect(jsonLogs.some((line) => line.includes('"instructionContexts"'))).toBe(true);
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

      expect(stripAnsiLines(logs)).toContain("Snapshot revert plan");
      expect(logs.some((line) => line.includes("Would restore notes.txt"))).toBe(true);
      expect(logs.some((line) => line.includes("Would delete created.txt"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("revert asks for approval before applying", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const approvalRequests: Array<{ snapshotId: string; actions: number }> = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSampleSnapshotLog(rootDir);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(rootDir, "notes.txt"), "after\n");
      await writeFile(join(rootDir, "created.txt"), "created\n");

      await buildProgram({
        cwd: rootDir,
        revertApprovalPrompter: async ({ snapshotId, actions }) => {
          approvalRequests.push({ snapshotId, actions: actions.length });
          return true;
        },
      }).parseAsync(["revert", "snapshot-001"], { from: "user" });

      expect(approvalRequests).toEqual([{ snapshotId: "snapshot-001", actions: 2 }]);
      expect(stripAnsiLines(logs)).toContain("Snapshot revert plan");
      expect(logs.some((line) => line.includes("Would restore notes.txt"))).toBe(true);
      expect(logs.some((line) => line.includes("Would delete created.txt"))).toBe(true);
      expect(logs.some((line) => line.includes("Reverted snapshot snapshot-001"))).toBe(true);
      expect(await readFile(join(rootDir, "notes.txt"), "utf8")).toBe("before\n");
      await expect(stat(join(rootDir, "created.txt"))).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("revert asks for approval and leaves files unchanged when cancelled", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSampleSnapshotLog(rootDir);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(rootDir, "notes.txt"), "after\n");
      await writeFile(join(rootDir, "created.txt"), "created\n");

      await buildProgram({
        cwd: rootDir,
        revertApprovalPrompter: async () => false,
      }).parseAsync(["revert", "snapshot-001"], { from: "user" });

      expect(stripAnsiLines(logs)).toContain("Snapshot revert plan");
      expect(logs.some((line) => line.includes("Would restore notes.txt"))).toBe(true);
      expect(logs.some((line) => line.includes("Revert cancelled."))).toBe(true);
      expect(await readFile(join(rootDir, "notes.txt"), "utf8")).toBe("after\n");
      expect(await readFile(join(rootDir, "created.txt"), "utf8")).toBe("created\n");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("revert does not apply in non-interactive mode", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSampleSnapshotLog(rootDir);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(rootDir, "notes.txt"), "after\n");
      await writeFile(join(rootDir, "created.txt"), "created\n");

      await buildProgram({ cwd: rootDir }).parseAsync(["revert", "snapshot-001"], {
        from: "user",
      });

      expect(stripAnsiLines(logs)).toContain("Snapshot revert plan");
      expect(
        logs.some((line) =>
          line.includes("Run from an interactive terminal to approve the revert."),
        ),
      ).toBe(true);
      expect(logs.some((line) => line.includes("Revert cancelled."))).toBe(true);
      expect(await readFile(join(rootDir, "notes.txt"), "utf8")).toBe("after\n");
      expect(await readFile(join(rootDir, "created.txt"), "utf8")).toBe("created\n");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

async function writeSampleSnapshotLog(rootDir: string): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
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
        purpose: "Exercise history",
        reason: "Test history tree",
        expected: "A note changes",
        verify: "Run tests",
        rollback: "Restore pre snapshot",
        instruction_context: {
          mode: "opt_in",
          captured_at: "2026-06-22T17:04:23Z",
          session_id_hash: "sha256:session",
          git: { branch: "main", commit: "abc123", dirty: true },
          files: [
            {
              path: "AGENTS.md",
              status: "captured",
              sha256: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              bytes: 12,
            },
            { path: "CLAUDE.md", status: "missing" },
          ],
          skills: [
            {
              name: "pony-trail",
              path: "bundled-skills/pony-trail/SKILL.md",
              status: "captured",
              version_or_sha256:
                "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            },
          ],
          warnings: [],
        },
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

function stripAnsiLines(values: string[]): string[] {
  return values.map(stripAnsi);
}
