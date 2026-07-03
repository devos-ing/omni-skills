import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createWorkflowBundleScaffold,
  getWorkflowSkillInstallSources,
  installWorkflowBundle,
  listInstalledWorkflowBundles,
  loadWorkflowBundle,
  type WorkflowGitCommand,
} from "../src/runtimes/ponytrail/workflow-bundles";

describe("workflow bundles", () => {
  test("rejects bare workflow names now that bundled workflows are removed", async () => {
    await expect(loadWorkflowBundle("product-dev")).rejects.toThrow(
      "Unsupported GetSuperpower source: product-dev",
    );
  });

  test("rejects duplicate workflow step ids", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-"));
    const bundleDir = join(rootDir, "duplicate-steps");
    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "duplicate-steps",
          version: "0.1.0",
          description: "Invalid duplicate step ids.",
          skills: [{ source: "pony-trail" }],
          steps: [
            { id: "same", title: "First", skill: "pony-trail" },
            { id: "same", title: "Second", skill: "pony-trail" },
          ],
        },
        null,
        2,
      ),
    );

    await expect(loadWorkflowBundle(bundleDir)).rejects.toThrow("Duplicate workflow step id: same");
  });

  test("scaffolds an authorable workflow bundle with a local skill", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-scaffold-"));

    const scaffold = await createWorkflowBundleScaffold({
      rootDir,
      name: "release-review",
    });

    await expect(stat(join(scaffold.bundleDir, "workflow.json"))).resolves.toBeTruthy();
    await expect(
      stat(join(scaffold.bundleDir, "skills", "custom-review", "SKILL.md")),
    ).resolves.toBeTruthy();
    await expect(
      stat(join(scaffold.bundleDir, "skills", "release-review", "SKILL.md")),
    ).resolves.toBeTruthy();

    const bundle = await loadWorkflowBundle(scaffold.bundleDir);
    expect(bundle.manifest.name).toBe("release-review");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toContain(
      "./skills/release-review",
    );
    expect(bundle.manifest.skills.map((skill) => skill.source)).toContain("./skills/custom-review");
    await expect(readFile(scaffold.readmePath, "utf8")).resolves.toContain(
      "A GetSuperpower that composes reusable agent skills.",
    );
    await expect(
      readFile(join(scaffold.bundleDir, "skills", "release-review", "SKILL.md"), "utf8"),
    ).resolves.toContain("This is the entry skill for the release-review GetSuperpower.");
    await expect(
      readFile(join(scaffold.bundleDir, "skills", "custom-review", "SKILL.md"), "utf8"),
    ).resolves.toContain("Review this GetSuperpower from the author perspective.");
  });

  test("loads the release-review example workflow with its local skill", async () => {
    const bundle = await loadWorkflowBundle("examples/workflows/release-review");

    expect(bundle.manifest.name).toBe("release-review");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toContain(
      "./skills/release-risk-review",
    );
    expect(bundle.manifest.steps.map((step) => step.id)).toEqual([
      "shape",
      "release-risk-review",
      "plan",
      "evidence",
    ]);
  });

  test("loads the real-engineering example workflow with mattpocock skill sources", async () => {
    const bundle = await loadWorkflowBundle("examples/workflows/real-engineering");

    expect(bundle.manifest.name).toBe("real-engineering");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toEqual([
      "./skills/rtk-command-discipline",
      "pony-trail",
      "superpowers:brainstorming",
      "superpowers:writing-plans",
      "mattpocock:grill-with-docs",
      "mattpocock:tdd",
      "mattpocock:codebase-design",
      "mattpocock:diagnosing-bugs",
    ]);
    expect(bundle.manifest.steps.map((step) => [step.id, step.skill])).toEqual([
      ["command-discipline", "./skills/rtk-command-discipline"],
      ["shape", "superpowers:brainstorming"],
      ["grill", "mattpocock:grill-with-docs"],
      ["plan", "superpowers:writing-plans"],
      ["design", "mattpocock:codebase-design"],
      ["tdd", "mattpocock:tdd"],
      ["debug", "mattpocock:diagnosing-bugs"],
      ["evidence", "pony-trail"],
    ]);
  });

  test("loads the development-design-delivery example workflow", async () => {
    const bundle = await loadWorkflowBundle("examples/workflows/development-design-delivery");

    expect(bundle.manifest.name).toBe("development-design-delivery");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toEqual([
      "./skills/development-design-delivery",
      "superpowers:brainstorming",
      "mattpocock:design-an-interface",
      "mattpocock:grill-with-docs",
      "superpowers:writing-plans",
      "mattpocock:codebase-design",
      "mattpocock:tdd",
      "mattpocock:diagnosing-bugs",
      "mattpocock:review",
      "pony-trail",
    ]);
    expect(bundle.manifest.steps.map((step) => [step.id, step.skill, step.gate ?? null])).toEqual([
      ["shape", "superpowers:brainstorming", "human_approval"],
      ["interface-design", "mattpocock:design-an-interface", "human_approval"],
      ["requirement-review", "mattpocock:grill-with-docs", "human_approval"],
      ["implementation-plan", "superpowers:writing-plans", null],
      ["architecture-boundary", "mattpocock:codebase-design", null],
      ["build", "mattpocock:tdd", null],
      ["debug", "mattpocock:diagnosing-bugs", null],
      ["review", "mattpocock:review", null],
      ["evidence", "pony-trail", null],
    ]);
    await expect(
      readFile(
        join(
          import.meta.dir,
          "..",
          "examples",
          "workflows",
          "development-design-delivery",
          "skills",
          "development-design-delivery",
          "SKILL.md",
        ),
        "utf8",
      ),
    ).resolves.toContain(
      "This is the entry skill for the development-design-delivery GetSuperpower.",
    );
  });

  test("loads the openspec delivery example workflow from the handoff diagram", async () => {
    const bundle = await loadWorkflowBundle("examples/workflows/openspec-superpowers");

    expect(bundle.manifest.name).toBe("openspec-delivery");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toEqual([
      "./skills/openspec-delivery",
      "./skills/opsx-handoff-review",
      "superpowers:brainstorming",
      "superpowers:writing-plans",
      "mattpocock:tdd",
      "pony-trail",
    ]);
    expect(bundle.manifest.steps.map((step) => [step.id, step.skill])).toEqual([
      ["opsx-propose", "./skills/opsx-handoff-review"],
      ["opsx-review", "./skills/opsx-handoff-review"],
      ["design-deepening", "superpowers:brainstorming"],
      ["implementation-plan", "superpowers:writing-plans"],
      ["task-by-task-build", "mattpocock:tdd"],
      ["verification", "pony-trail"],
      ["opsx-archive", "./skills/opsx-handoff-review"],
    ]);
    await expect(
      readFile(
        join(
          import.meta.dir,
          "..",
          "examples",
          "workflows",
          "openspec-superpowers",
          "skills",
          "openspec-delivery",
          "SKILL.md",
        ),
        "utf8",
      ),
    ).resolves.toContain("This is the entry skill for the openspec-delivery GetSuperpower.");
  });

  test("loads a workflow bundle from a public git URL", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-bundle-git-"));
    const source = "https://github.com/acme/release-review.git";
    const commands: WorkflowGitCommand[] = [];
    let checkoutDir = "";

    const bundle = await loadWorkflowBundle(source, {
      tempDir,
      runGitCommand: async (command) => {
        commands.push(command);
        if (command.args[0] === "clone") {
          checkoutDir = command.args.at(-1) ?? "";
          await mkdir(join(checkoutDir, "skills", "git-entry"), { recursive: true });
          await writeFile(
            join(checkoutDir, "skills", "git-entry", "SKILL.md"),
            [
              "---",
              "name: git-entry",
              'description: "Entry skill from a public git workflow."',
              "---",
              "",
              "# git-entry",
            ].join("\n"),
          );
          await writeFile(
            join(checkoutDir, "workflow.json"),
            JSON.stringify(
              {
                schemaVersion: "0.1",
                name: "git-workflow",
                version: "0.1.0",
                description: "Installs from git.",
                skills: [{ source: "./skills/git-entry" }],
                steps: [{ id: "entry", title: "Entry", skill: "./skills/git-entry" }],
              },
              null,
              2,
            ),
          );
          return { stdout: "", stderr: "", exitCode: 0 };
        }

        return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      },
    });

    expect(commands.map((command) => command.args[0])).toEqual(["clone", "rev-parse"]);
    expect(commands[0]?.args).toEqual(["clone", "--depth", "1", source, checkoutDir]);
    expect(bundle.manifest.name).toBe("git-workflow");
    expect(bundle.source).toEqual({ kind: "git", url: source, commit: "abc123" });
    expect(getWorkflowSkillInstallSources(bundle)).toEqual([
      join(checkoutDir, "skills", "git-entry"),
    ]);

    await bundle.cleanup?.();
    await expect(stat(checkoutDir)).rejects.toThrow();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("loads a public git workflow from a URL fragment subdirectory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-bundle-git-subdir-"));
    const source = "https://github.com/acme/workflows.git#examples/release-review";
    const commands: WorkflowGitCommand[] = [];
    let checkoutDir = "";

    const bundle = await loadWorkflowBundle(source, {
      tempDir,
      runGitCommand: async (command) => {
        commands.push(command);
        if (command.args[0] === "clone") {
          checkoutDir = command.args.at(-1) ?? "";
          const workflowDir = join(checkoutDir, "examples", "release-review");
          await mkdir(join(workflowDir, "skills", "git-entry"), { recursive: true });
          await writeFile(
            join(workflowDir, "skills", "git-entry", "SKILL.md"),
            [
              "---",
              "name: git-entry",
              'description: "Entry skill from a public git workflow subdirectory."',
              "---",
              "",
              "# git-entry",
            ].join("\n"),
          );
          await writeFile(
            join(workflowDir, "workflow.json"),
            JSON.stringify(
              {
                schemaVersion: "0.1",
                name: "git-subdir-workflow",
                version: "0.1.0",
                description: "Installs from a git subdirectory.",
                skills: [{ source: "./skills/git-entry" }],
                steps: [{ id: "entry", title: "Entry", skill: "./skills/git-entry" }],
              },
              null,
              2,
            ),
          );
          return { stdout: "", stderr: "", exitCode: 0 };
        }

        return { stdout: "def456\n", stderr: "", exitCode: 0 };
      },
    });

    expect(commands[0]?.args).toEqual([
      "clone",
      "--depth",
      "1",
      "https://github.com/acme/workflows.git",
      checkoutDir,
    ]);
    expect(bundle.source).toEqual({
      kind: "git",
      url: source,
      commit: "def456",
      subdirectory: "examples/release-review",
    });
    expect(getWorkflowSkillInstallSources(bundle)).toEqual([
      join(checkoutDir, "examples", "release-review", "skills", "git-entry"),
    ]);

    await bundle.cleanup?.();
    await expect(stat(checkoutDir)).rejects.toThrow();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("loads a workflow from a file git URL with the default git runner", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-file-git-"));
    const sourceRepo = join(rootDir, "source");
    const tempDir = join(rootDir, "tmp");

    await mkdir(join(sourceRepo, "skills", "file-entry"), { recursive: true });
    await mkdir(tempDir, { recursive: true });
    await writeFile(
      join(sourceRepo, "skills", "file-entry", "SKILL.md"),
      [
        "---",
        "name: file-entry",
        'description: "Entry skill from a file git workflow."',
        "---",
        "",
        "# file-entry",
      ].join("\n"),
    );
    await writeFile(
      join(sourceRepo, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "file-git-workflow",
          version: "0.1.0",
          description: "Installs from a file git source.",
          skills: [{ source: "./skills/file-entry" }],
          steps: [{ id: "entry", title: "Entry", skill: "./skills/file-entry" }],
        },
        null,
        2,
      ),
    );
    await runGit(["init"], sourceRepo);
    await runGit(["config", "user.email", "test@example.invalid"], sourceRepo);
    await runGit(["config", "user.name", "Workflow Test"], sourceRepo);
    await runGit(["add", "."], sourceRepo);
    await runGit(["commit", "-m", "add workflow"], sourceRepo);

    const bundle = await loadWorkflowBundle(pathToFileURL(sourceRepo).href, { tempDir });

    expect(bundle.manifest.name).toBe("file-git-workflow");
    expect(bundle.source.kind).toBe("git");
    expect(bundle.source).toHaveProperty("commit");
    expect(getWorkflowSkillInstallSources(bundle)[0]).toContain("file-entry");
    await bundle.cleanup?.();
    expect(
      (await readdir(tempDir)).filter((entry) => entry.startsWith("getsuperpower-git-")),
    ).toEqual([]);
    await rm(rootDir, { recursive: true, force: true });
  });

  test("reports public git clone failures with the source URL", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-bundle-git-failure-"));
    const source = "https://github.com/acme/missing-workflow.git";

    await expect(
      loadWorkflowBundle(source, {
        tempDir,
        runGitCommand: async () => ({
          stdout: "",
          stderr: "repository not found",
          exitCode: 128,
        }),
      }),
    ).rejects.toThrow(`Public git workflow source could not be fetched: ${source}`);

    expect(await readdir(tempDir)).toEqual([]);
    await rm(tempDir, { recursive: true, force: true });
  });

  test("cleans a public git checkout when workflow.json is missing", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-bundle-git-missing-"));
    let checkoutDir = "";

    await expect(
      loadWorkflowBundle("https://github.com/acme/not-a-workflow.git", {
        tempDir,
        runGitCommand: async (command) => {
          if (command.args[0] === "clone") {
            checkoutDir = command.args.at(-1) ?? "";
            await mkdir(checkoutDir, { recursive: true });
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          return { stdout: "abc123\n", stderr: "", exitCode: 0 };
        },
      }),
    ).rejects.toThrow("No GetSuperpower workflow manifest was found");

    await expect(stat(checkoutDir)).rejects.toThrow();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("installs and lists workflow bundles under .getsuperpower", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-install-"));
    const bundle = await loadWorkflowBundle("examples/workflows/release-review");

    const installed = await installWorkflowBundle({
      rootDir,
      bundle,
    });

    expect(installed.path).toBe(
      join(rootDir, ".getsuperpower", "workflows", "release-review.json"),
    );
    const installedFile = JSON.parse(await readFile(installed.path, "utf8"));
    expect(installedFile.name).toBe("release-review");
    expect(installedFile.steps).toHaveLength(4);

    const workflows = await listInstalledWorkflowBundles({ rootDir });
    expect(workflows.map((workflow) => workflow.name)).toEqual(["release-review"]);
  });
});

async function runGit(args: string[], cwd: string): Promise<void> {
  const subprocess = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${stderr.trim() || stdout.trim()}`);
  }
}
