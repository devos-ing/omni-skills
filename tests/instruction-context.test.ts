import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  captureInstructionContext,
  shouldCaptureInstructionContext,
} from "../src/runtimes/getsuperpower/instruction-context";

const execFileAsync = promisify(execFile);

describe("instruction context", () => {
  test("hashes allowlisted instruction files with stable ordering", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-instructions-"));

    try {
      await writeFile(join(rootDir, "AGENTS.md"), "agent rules\n");
      await mkdir(join(rootDir, ".cursor", "rules"), { recursive: true });
      await writeFile(join(rootDir, ".cursor", "rules", "review.mdc"), "review rules\n");
      await mkdir(join(rootDir, ".cursor", "rules", "team"), { recursive: true });
      await writeFile(join(rootDir, ".cursor", "rules", "team", "security.mdc"), "security\n");
      await mkdir(join(rootDir, ".github"), { recursive: true });
      await writeFile(join(rootDir, ".github", "copilot-instructions.md"), "copilot rules\n");
      await mkdir(join(rootDir, "bundled-skills", "pony-trail"), { recursive: true });
      await writeFile(join(rootDir, "bundled-skills", "pony-trail", "SKILL.md"), "skill\n");

      const context = await captureInstructionContext({
        rootDir,
        sessionId: "session-alpha",
        timestampUtc: "2026-06-22T17:04:23Z",
        git: { branch: "main", commit: "abc123", dirty: true },
      });

      expect(context).toMatchObject({
        mode: "opt_in",
        captured_at: "2026-06-22T17:04:23Z",
        session_id_hash: "sha256:99b1d23983d285eb64aa2e321f429dd6678a40ec15149dc258098ed6a5bd536d",
        git: { branch: "main", commit: "abc123", dirty: true },
        warnings: [],
      });
      expect(context.files.map((file) => file.path)).toEqual([
        ".cursor/rules/review.mdc",
        ".cursor/rules/team/security.mdc",
        ".github/copilot-instructions.md",
        "AGENTS.md",
        "CLAUDE.md",
      ]);
      expect(context.files[0]).toMatchObject({
        path: ".cursor/rules/review.mdc",
        status: "captured",
        bytes: 13,
      });
      expect(context.files[0]?.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(context.files[4]).toEqual({ path: "CLAUDE.md", status: "missing" });
      expect(context.skills).toEqual([
        {
          name: "pony-trail",
          path: "bundled-skills/pony-trail/SKILL.md",
          status: "captured",
          version_or_sha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        },
      ]);
      expect(JSON.stringify(context)).not.toContain("agent rules");
      expect(JSON.stringify(context)).not.toContain("review rules");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("treats non-file instruction paths as warnings without failing capture", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-instructions-"));

    try {
      await writeFile(join(rootDir, "AGENTS.md"), "agent rules\n");
      await mkdir(join(rootDir, "CLAUDE.md"));

      const context = await captureInstructionContext({
        rootDir,
        sessionId: "session-alpha",
        timestampUtc: "2026-06-22T17:04:23Z",
      });

      expect(context.git.branch).toBeUndefined();
      expect(context.git.commit).toBeUndefined();
      expect(context.git.dirty).toBeUndefined();
      expect(context.files.find((file) => file.path === "CLAUDE.md")).toEqual({
        path: "CLAUDE.md",
        status: "unreadable",
      });
      expect(context.warnings).toContain("CLAUDE.md unreadable");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("records warnings for unreadable context paths without failing capture", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-instructions-"));
    const rulesDir = join(rootDir, ".cursor", "rules");
    const claudePath = join(rootDir, "CLAUDE.md");

    try {
      await writeFile(join(rootDir, "AGENTS.md"), "agent rules\n");
      await mkdir(rulesDir, { recursive: true });
      await writeFile(claudePath, "claude rules\n");
      await chmod(rulesDir, 0o000);
      await chmod(claudePath, 0o000);

      const context = await captureInstructionContext({
        rootDir,
        sessionId: "session-alpha",
        timestampUtc: "2026-06-22T17:04:23Z",
      });

      expect(context.files.find((file) => file.path === "CLAUDE.md")).toEqual({
        path: "CLAUDE.md",
        status: "unreadable",
      });
      expect(context.warnings).toEqual(
        expect.arrayContaining([".cursor/rules unreadable", "CLAUDE.md unreadable"]),
      );
    } finally {
      await chmod(rulesDir, 0o700).catch(() => {});
      await chmod(claudePath, 0o600).catch(() => {});
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("ignores inherited Git hook environment when reading git context", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-instructions-"));
    const inheritedGitDir = await currentWorktreeGitDir();
    const originalGitDir = process.env.GIT_DIR;

    try {
      process.env.GIT_DIR = inheritedGitDir;

      const context = await captureInstructionContext({
        rootDir,
        sessionId: "session-alpha",
        timestampUtc: "2026-06-22T17:04:23Z",
      });

      expect(context.git.branch).toBeUndefined();
      expect(context.git.commit).toBeUndefined();
      expect(context.git.dirty).toBeUndefined();
    } finally {
      if (originalGitDir === undefined) {
        delete process.env.GIT_DIR;
      } else {
        process.env.GIT_DIR = originalGitDir;
      }
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("captures allowlisted git metadata when the root is a git repository", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-instructions-"));

    try {
      await execFileAsync("git", ["init"], { cwd: rootDir, env: withoutGitEnv() });
      await writeFile(join(rootDir, "AGENTS.md"), "agent rules\n");

      const context = await captureInstructionContext({
        rootDir,
        sessionId: "session-alpha",
        timestampUtc: "2026-06-22T17:04:23Z",
      });

      expect(context.git.branch).toBeString();
      expect(context.git.commit).toBeUndefined();
      expect(context.git.dirty).toBe(true);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("normalizes opt-in from explicit options and environment", () => {
    expect(shouldCaptureInstructionContext({ instructionContext: true, env: {} })).toBe(true);
    expect(shouldCaptureInstructionContext({ instructionContext: false, env: {} })).toBe(false);
    expect(
      shouldCaptureInstructionContext({
        instructionContext: undefined,
        env: { PONYTRAIL_INSTRUCTION_CONTEXT: "1" },
      }),
    ).toBe(true);
    expect(
      shouldCaptureInstructionContext({
        instructionContext: undefined,
        env: { PONYTRAIL_INSTRUCTION_CONTEXT: "true" },
      }),
    ).toBe(true);
    expect(
      shouldCaptureInstructionContext({
        instructionContext: undefined,
        env: { PONYTRAIL_INSTRUCTION_CONTEXT: "yes" },
      }),
    ).toBe(true);
    expect(
      shouldCaptureInstructionContext({
        instructionContext: undefined,
        env: { PONYTRAIL_INSTRUCTION_CONTEXT: "0" },
      }),
    ).toBe(false);
  });
});

async function currentWorktreeGitDir(): Promise<string> {
  const gitPath = join(process.cwd(), ".git");
  if ((await stat(gitPath)).isDirectory()) {
    return gitPath;
  }

  const content = await readFile(gitPath, "utf8");
  const gitDirPrefix = "gitdir:";
  if (content.startsWith(gitDirPrefix)) {
    return resolve(process.cwd(), content.slice(gitDirPrefix.length).trim());
  }
  return gitPath;
}

function withoutGitEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("GIT_")) {
      delete env[key];
    }
  }
  return env;
}
