import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(import.meta.dir, "..");
const workRoot = join(repoRoot, "work", "raw-sandbox-public-git-install");
const sourceRepo = join(workRoot, "source-repo");
const projectDir = join(workRoot, "project");
const homeDir = join(workRoot, "home");
const tempDir = join(workRoot, "tmp");
const source = process.env.PUBLIC_GIT_WORKFLOW_SOURCE ?? pathToFileURL(sourceRepo).href;

async function main(): Promise<void> {
  await rm(workRoot, { recursive: true, force: true });
  await mkdir(join(sourceRepo, "skills", "raw-sandbox-entry"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await mkdir(homeDir, { recursive: true });
  await mkdir(tempDir, { recursive: true });

  await writeFile(
    join(sourceRepo, "skills", "raw-sandbox-entry", "SKILL.md"),
    [
      "---",
      "name: raw-sandbox-entry",
      'description: "Entry skill for the raw sandbox git install smoke."',
      "---",
      "",
      "# Raw Sandbox Entry",
      "",
      "Use this skill to prove Omniskills can install a workflow from git.",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(sourceRepo, "workflow.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1",
        name: "raw-sandbox-git",
        version: "0.1.0",
        description: "Raw sandbox git install smoke workflow.",
        skills: [{ source: "./skills/raw-sandbox-entry" }],
        steps: [
          {
            id: "entry",
            title: "Run the raw sandbox entry skill",
            skill: "./skills/raw-sandbox-entry",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  await run(["git", "init"], { cwd: sourceRepo });
  await run(["git", "config", "user.email", "smoke@example.invalid"], { cwd: sourceRepo });
  await run(["git", "config", "user.name", "Omniskills Smoke"], { cwd: sourceRepo });
  await run(["git", "add", "."], { cwd: sourceRepo });
  await run(["git", "commit", "-m", "add raw sandbox workflow"], { cwd: sourceRepo });

  await run(
    [
      process.execPath,
      join(repoRoot, "src", "cli.ts"),
      "install",
      source,
      "--dir",
      projectDir,
      "--home",
      homeDir,
      "--agents",
      "codex",
    ],
    {
      cwd: repoRoot,
      env: {
        PATH: process.env.PATH,
        HOME: homeDir,
        TMPDIR: tempDir,
      },
    },
  );

  const workflowDir = join(projectDir, ".getsuperpower", "workflows");
  const workflowFiles = (await readdir(workflowDir)).filter((file) => file.endsWith(".json"));
  if (workflowFiles.length === 0) {
    throw new Error(`No workflow records were written under ${workflowDir}`);
  }
  const workflowFile = workflowFiles[0];
  if (!workflowFile) {
    throw new Error(`No workflow record was available under ${workflowDir}`);
  }

  const skillDir = join(homeDir, ".agents", "skills");
  const skillNames = await readdir(skillDir);
  if (skillNames.length === 0) {
    throw new Error(`No Codex skills were installed under ${skillDir}`);
  }
  const tempEntries = (await readdir(tempDir)).filter((entry) =>
    entry.startsWith("getsuperpower-git-"),
  );
  if (tempEntries.length !== 0) {
    throw new Error(`Temporary git checkout directories were not cleaned under ${tempDir}`);
  }

  const workflow = JSON.parse(await readFile(join(workflowDir, workflowFile), "utf8"));
  if (workflow.source?.kind !== "git") {
    throw new Error(`Expected installed workflow source kind git, got ${workflow.source?.kind}`);
  }

  console.log(`Raw sandbox git install passed: ${workflowFile}`);
  console.log(`Project: ${projectDir}`);
  console.log(`Home: ${homeDir}`);
}

async function run(
  command: string[],
  options: {
    cwd: string;
    env?: Record<string, string | undefined>;
  },
): Promise<void> {
  const subprocess = Bun.spawn(command, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  if (stdout.trim()) {
    console.log(stdout.trim());
  }
  if (stderr.trim()) {
    console.error(stderr.trim());
  }
  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed with exit ${exitCode}`);
  }
}

await main();
