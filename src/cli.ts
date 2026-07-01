#!/usr/bin/env bun

import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { confirm, isCancel } from "@clack/prompts";
import { Command } from "commander";
import pc from "picocolors";
import {
  configureGetSuperpowerCommand,
  type GetSuperpowerExternalSkillDependencyInstaller,
  getSkillsCliPackageForSource,
  installExternalSkillDependencyWithSkillsCli,
} from "../getsuperpower-command";
import { installAgentSkill, parseSkillInstallAgents, type SkillInstallResult } from "./plugins";
import {
  applySnapshotRevert,
  type InstructionContext,
  planSnapshotRevert,
  type RecordedSnapshotCommit,
  readSnapshotHistory,
  recordSnapshotPost,
  recordSnapshotPre,
  type SnapshotCommit,
  type SnapshotFileState,
  type SnapshotRevertAction,
} from "./runtimes/ponytrail";

export interface RevertApprovalPromptInput {
  snapshotId: string;
  actions: SnapshotRevertAction[];
}

export type RevertApprovalPrompter = (input: RevertApprovalPromptInput) => Promise<boolean>;

type SnapshotHistoryMode = "tree" | "details";
type SkillChangeOperation = "install" | "update";

const skillInstallHistorySessionId = "ponyrace-skills";
const CLI_VERSION = "0.2.0";

interface CommanderVersionInternals {
  _outputConfiguration: {
    writeOut: (value: string) => void;
  };
  _exit: (exitCode: number, code: string, message: string) => never;
}

export interface BuildProgramOptions {
  cwd?: string;
  revertApprovalPrompter?: RevertApprovalPrompter;
  installExternalSkillDependency?: GetSuperpowerExternalSkillDependencyInstaller;
}

export function buildProgram(options: BuildProgramOptions = {}): Command {
  const rootDir = options.cwd ?? process.cwd();
  const revertApprovalPrompter = options.revertApprovalPrompter ?? promptForRevertApproval;
  const installExternalSkillDependency =
    options.installExternalSkillDependency ?? installExternalSkillDependencyWithSkillsCli;
  const program = new Command();

  program
    .name("ponyrace")
    .description("Install, author, and inspect GetSuperpower skill trees.")
    .version(CLI_VERSION)
    .option("-v", "output the version number");

  program.on("option:v", () => {
    outputVersionAndExit(program, CLI_VERSION);
  });

  program
    .command("history")
    .description("Show local skill and bundle install snapshot history.")
    .option("-s, --session <id>", "only show one snapshot session")
    .option("--mode <mode>", "history output mode: tree,details", "tree")
    .option("--details", "include detailed snapshot metadata", false)
    .option("--json", "print JSON output", false)
    .action(
      async (commandOptions: {
        session?: string;
        mode: string;
        details: boolean;
        json: boolean;
      }) => {
        const history = await readSnapshotHistory({
          rootDir,
          sessionId: commandOptions.session,
        });

        if (commandOptions.json) {
          console.log(JSON.stringify(history, null, 2));
          return;
        }

        printSnapshotHistory(
          history.sessions,
          commandOptions.details ? "details" : parseSnapshotHistoryMode(commandOptions.mode),
        );
      },
    );

  program
    .command("revert")
    .description("Restore files from a snapshot pre-state.")
    .argument("<snapshot-id>", "snapshot id to restore")
    .option("--dry-run", "show planned file actions without writing files", false)
    .action(
      async (
        snapshotId: string,
        commandOptions: {
          dryRun: boolean;
        },
      ) => {
        const plan = await planSnapshotRevert({ rootDir, snapshotId });
        printSnapshotRevertPlan(plan.actions, true);

        if (commandOptions.dryRun) {
          return;
        }

        const approved = await revertApprovalPrompter({
          snapshotId,
          actions: plan.actions,
        });

        if (!approved) {
          console.log(pc.dim("Revert cancelled."));
          return;
        }

        await applySnapshotRevert(plan);
        console.log(pc.green(`Reverted snapshot ${snapshotId}`));
      },
    );

  configureGetSuperpowerCommand(program, {
    rootDir,
    installSkillWithLocalHistory,
    printSkillInstallResult,
    installExternalSkillDependency,
  });

  const skillsCommand = program.command("skills").description("Manage agent skills.");

  configureSkillInstallCommand(
    skillsCommand
      .command("install")
      .description("Install a bundled, local, Superpowers, or external skills package."),
    rootDir,
    installExternalSkillDependency,
  );
  configureSkillChangeCommand(
    skillsCommand
      .command("update")
      .description("Update a bundled or local skill for configured agent targets."),
    rootDir,
    "update",
  );

  return program;
}

function outputVersionAndExit(program: Command, version: string): never {
  const command = program as Command & CommanderVersionInternals;

  command._outputConfiguration.writeOut(`${version}\n`);
  return command._exit(0, "commander.version", version);
}

async function promptForRevertApproval(input: RevertApprovalPromptInput): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.log(pc.dim("Run from an interactive terminal to approve the revert."));
    return false;
  }

  const answer = await confirm({
    message: `Apply revert ${input.snapshotId}?`,
    active: `Apply ${input.actions.length} file action${input.actions.length === 1 ? "" : "s"}`,
    inactive: "Cancel",
    initialValue: false,
  });

  return answer === true && !isCancel(answer);
}

function configureSkillInstallCommand(
  command: Command,
  rootDir: string,
  installExternalSkillDependency: GetSuperpowerExternalSkillDependencyInstaller,
): Command {
  return configureSkillChangeCommand(
    command,
    rootDir,
    "install",
    installExternalSkillDependency,
  ).option("-f, --force", "overwrite existing installed skill folders", false);
}

function configureSkillChangeCommand(
  command: Command,
  rootDir: string,
  operation: SkillChangeOperation,
  installExternalSkillDependency?: GetSuperpowerExternalSkillDependencyInstaller,
): Command {
  return command
    .argument("[source-or-name]", "bundled skill name or local skill directory", "pony-trail")
    .option(
      "-a, --agents <agents>",
      "comma-separated targets: claude,copilot,codex,cursor",
      "claude,copilot,codex,cursor",
    )
    .option("--home <dir>", "home directory that contains agent config folders", homedir())
    .option("--dry-run", `show ${operation} destinations without writing files`, false)
    .option("--prehook", "also install a Ponytrail prehook reminder for file mutations", false)
    .action(
      async (
        sourceOrName: string,
        commandOptions: {
          agents: string;
          home: string;
          dryRun: boolean;
          prehook: boolean;
          force?: boolean;
        },
      ) => {
        const homeDir = resolveHomePath(commandOptions.home);
        const externalSkillsPackage = getExternalSkillsPackageInstallSource(sourceOrName);
        if (operation === "install" && externalSkillsPackage && installExternalSkillDependency) {
          const result = await installExternalSkillsPackageWithLocalHistory({
            rootDir,
            source: sourceOrName,
            packageName: externalSkillsPackage,
            homeDir,
            dryRun: commandOptions.dryRun,
            installExternalSkillDependency,
          });
          printExternalSkillsPackageInstallResult(result);
          return;
        }

        const result = await installSkillWithLocalHistory({
          rootDir,
          operation,
          source: sourceOrName,
          homeDir,
          agents: parseSkillInstallAgents(commandOptions.agents),
          dryRun: commandOptions.dryRun,
          force: operation === "install" ? commandOptions.force === true : false,
          refreshExisting: false,
          installPrehook: commandOptions.prehook,
        });

        printSkillInstallResult(result.skillInstall, result.history, operation);
      },
    );
}

interface InstallSkillWithLocalHistoryInput {
  rootDir: string;
  operation: SkillChangeOperation;
  source: string;
  homeDir: string;
  agents: ReturnType<typeof parseSkillInstallAgents>;
  dryRun: boolean;
  force: boolean;
  refreshExisting: boolean;
  installPrehook: boolean;
}

interface InstallSkillWithLocalHistoryResult {
  skillInstall: SkillInstallResult;
  history?: RecordedSnapshotCommit | undefined;
}

interface SkillInstallPrintOptions {
  showPostSkillChangeWelcome?: boolean;
}

interface InstallExternalSkillsPackageWithLocalHistoryInput {
  rootDir: string;
  source: string;
  packageName: string;
  homeDir: string;
  dryRun: boolean;
  installExternalSkillDependency: GetSuperpowerExternalSkillDependencyInstaller;
}

interface InstallExternalSkillsPackageWithLocalHistoryResult {
  source: string;
  packageName: string;
  homeDir: string;
  dryRun: boolean;
  history?: RecordedSnapshotCommit | undefined;
}

async function installSkillWithLocalHistory(
  input: InstallSkillWithLocalHistoryInput,
): Promise<InstallSkillWithLocalHistoryResult> {
  const commandText = formatSkillInstallCommand(input);
  let history: RecordedSnapshotCommit | undefined;

  if (!input.dryRun) {
    history = await recordSnapshotPre({
      rootDir: input.rootDir,
      sessionId: skillInstallHistorySessionId,
      idPrefix: `skill-${input.operation}`,
      action: `${input.operation} skill`,
      purpose: `${formatSkillChangeVerb(input.operation)} ${input.source} skill for ${formatAgentList(
        input.agents,
      )}`,
      reason: "Keep project-local history before changing agent skill files.",
      expected: `The skill ${input.operation} result is captured in local history.`,
      verify: "ponyrace history --details",
      rollback:
        "Remove or reinstall the affected agent skill folders, then record another snapshot.",
    });
  }

  try {
    const skillInstall = await installAgentSkill({
      source: input.source,
      cwd: input.rootDir,
      homeDir: input.homeDir,
      agents: input.agents,
      dryRun: input.dryRun,
      force: input.force,
      operation: input.operation,
      refreshExisting: input.refreshExisting,
      installPrehook: input.installPrehook,
    });

    if (history) {
      history = await recordSnapshotPost({
        rootDir: input.rootDir,
        sessionId: history.sessionId,
        snapshotId: history.snapshotId,
        summary: formatSkillInstallSummary(skillInstall, input.operation),
        checks: commandText,
        result: formatSkillInstallHistoryResult(skillInstall),
      });
    }

    return { skillInstall, history };
  } catch (error) {
    if (history) {
      await recordSnapshotPost({
        rootDir: input.rootDir,
        sessionId: history.sessionId,
        snapshotId: history.snapshotId,
        summary: `Failed to ${input.operation} ${input.source} skill for ${formatAgentList(
          input.agents,
        )}`,
        checks: commandText,
        result: `fail: ${formatErrorMessage(error)}`,
      });
    }
    throw error;
  }
}

async function installExternalSkillsPackageWithLocalHistory(
  input: InstallExternalSkillsPackageWithLocalHistoryInput,
): Promise<InstallExternalSkillsPackageWithLocalHistoryResult> {
  if (input.dryRun) {
    return {
      source: input.source,
      packageName: input.packageName,
      homeDir: input.homeDir,
      dryRun: true,
    };
  }

  let history = await recordSnapshotPre({
    rootDir: input.rootDir,
    sessionId: skillInstallHistorySessionId,
    idPrefix: "skills-package-install",
    action: "install skills package",
    purpose: `Install ${input.packageName} skills package through the Skills CLI`,
    reason: "Keep project-local history before changing agent skill files.",
    expected: `The ${input.packageName} skills package is available under the configured home directory.`,
    verify: "ponyrace history --details",
    rollback: "Remove the affected installed skill folders, then record another snapshot.",
  });

  try {
    await input.installExternalSkillDependency({
      source: input.source,
      homeDir: input.homeDir,
    });

    history = await recordSnapshotPost({
      rootDir: input.rootDir,
      sessionId: history.sessionId,
      snapshotId: history.snapshotId,
      summary: `Installed ${input.packageName} skills package`,
      checks: formatExternalSkillsPackageInstallCommand(input),
      result: `installed:${input.packageName}`,
    });

    return {
      source: input.source,
      packageName: input.packageName,
      homeDir: input.homeDir,
      dryRun: false,
      history,
    };
  } catch (error) {
    await recordSnapshotPost({
      rootDir: input.rootDir,
      sessionId: history.sessionId,
      snapshotId: history.snapshotId,
      summary: `Failed to install ${input.packageName} skills package`,
      checks: formatExternalSkillsPackageInstallCommand(input),
      result: `fail: ${formatErrorMessage(error)}`,
    });
    throw error;
  }
}

function getExternalSkillsPackageInstallSource(source: string): string | null {
  if (source.includes(":")) {
    return null;
  }
  return getSkillsCliPackageForSource(source);
}

function resolveHomePath(path: string): string {
  if (path === "~") {
    return homedir();
  }
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return isAbsolute(path) ? path : resolve(path);
}

function printSkillInstallResult(
  result: SkillInstallResult,
  history?: RecordedSnapshotCommit | undefined,
  operation: SkillChangeOperation = "install",
  options: SkillInstallPrintOptions = {},
): void {
  console.log(pc.cyan(result.dryRun ? `Skill ${operation} plan` : `Skill ${operation} result`));
  console.log(`Skill: ${result.skillName}`);
  console.log(`${pc.dim("Source:")} ${result.source.path}`);

  for (const target of result.targets) {
    console.log(
      `${target.agent}: ${formatSkillInstallStatus(target.status)} ${pc.dim(target.destination)}`,
    );
  }

  if (result.prehooks.length > 0) {
    console.log("");
    console.log(
      pc.cyan(result.dryRun ? `Prehook ${operation} plan` : `Prehook ${operation} result`),
    );
    for (const prehook of result.prehooks) {
      console.log(
        `${prehook.agent}: ${formatSkillInstallStatus(prehook.status)} ${pc.dim(
          prehook.hookScript,
        )} ${pc.dim(`settings: ${prehook.settingsPath}`)}`,
      );
    }
  }

  if (history) {
    console.log("");
    console.log(`${pc.dim("Local history:")} ${history.snapshotId}`);
    console.log(`${pc.dim("History log:")} ${history.logPath}`);
  }

  if (options.showPostSkillChangeWelcome !== false) {
    printPostSkillChangeWelcome(result);
  }
}

function formatSkillInstallStatus(status: SkillInstallResult["targets"][number]["status"]): string {
  switch (status) {
    case "would_install":
      return "would install";
    case "would_overwrite":
      return "would overwrite";
    case "skipped_exists":
      return "skipped existing";
    case "overwritten":
      return "overwritten";
    case "installed":
      return "installed";
    case "updated":
      return "updated";
    case "would_update":
      return "would update";
    case "already_present":
      return "already present";
  }
}

function formatSkillInstallCommand(input: InstallSkillWithLocalHistoryInput): string {
  const flags = [
    `--home ${input.homeDir}`,
    `--agents ${formatAgentList(input.agents)}`,
    input.force ? "--force" : "",
    input.installPrehook ? "--prehook" : "",
  ].filter(Boolean);
  return ["ponyrace skills", input.operation, input.source, ...flags].join(" ");
}

function formatExternalSkillsPackageInstallCommand(input: {
  source: string;
  homeDir: string;
}): string {
  return `ponyrace skills install ${input.source} --home ${input.homeDir}`;
}

function printExternalSkillsPackageInstallResult(
  result: InstallExternalSkillsPackageWithLocalHistoryResult,
): void {
  console.log(
    pc.cyan(result.dryRun ? "Skills package install plan" : "Skills package install result"),
  );
  console.log(`Package: ${result.packageName}`);
  console.log(`${pc.dim("Home:")} ${result.homeDir}`);
  console.log(`${pc.dim("Internal command:")} npx --yes skills@latest add ${result.packageName}`);

  if (result.history) {
    console.log("");
    console.log(`${pc.dim("Local history:")} ${result.history.snapshotId}`);
    console.log(`${pc.dim("History log:")} ${result.history.logPath}`);
  }

  if (!result.dryRun) {
    console.log("");
    console.log(pc.green("Welcome to GetSuperpower."));
    console.log("Restart your agent IDE so it loads the latest skills.");
  }
}

function printSnapshotHistory(
  sessions: Array<{ sessionId: string; commits: SnapshotCommit[] }>,
  mode: SnapshotHistoryMode,
): void {
  if (sessions.length === 0) {
    console.log(pc.dim("No snapshot history found."));
    return;
  }

  if (mode === "tree") {
    printSnapshotHistoryTree(sessions, false);
    return;
  }

  printSnapshotHistoryTree(sessions, true);
}

function printSnapshotHistoryTree(
  sessions: Array<{ sessionId: string; commits: SnapshotCommit[] }>,
  includeDetails: boolean,
): void {
  console.log(pc.cyan("Snapshot history"));
  for (const session of sessions) {
    console.log(`* ${session.sessionId}`);
    for (const commit of session.commits) {
      console.log(`  * ${pc.yellow(commit.snapshotId)} ${formatSnapshotStatus(commit)}`);
      if (includeDetails) {
        printSnapshotCommitDetails(commit);
      }
    }
  }
}

function printSnapshotCommitDetails(commit: SnapshotCommit): void {
  if (commit.action) {
    console.log(`    action: ${commit.action}`);
  }
  if (commit.summary) {
    console.log(`    summary: ${commit.summary}`);
  }
  if (commit.checks) {
    console.log(`    checks: ${commit.checks}`);
  }
  if (commit.result) {
    console.log(`    result: ${commit.result}`);
  }
  if (commit.rollback) {
    console.log(`    rollback: ${commit.rollback}`);
  }
  for (const file of commit.files) {
    console.log(`    ${formatSnapshotFile(file)}`);
  }
  printInstructionContextDetails("pre", commit.instructionContexts.pre);
  printInstructionContextDetails("post", commit.instructionContexts.post);
}

function parseSnapshotHistoryMode(mode: string): SnapshotHistoryMode {
  if (mode === "tree" || mode === "details") {
    return mode;
  }
  if (mode === "simple") {
    return "tree";
  }

  throw new Error(`Unknown history mode: ${mode}. Use tree or details.`);
}

function formatSnapshotStatus(commit: SnapshotCommit): string {
  if (commit.hasPre && commit.hasPost) {
    return pc.dim("(pre/post)");
  }
  if (commit.hasPre) {
    return pc.dim("(pre only)");
  }
  return pc.dim("(post only)");
}

function formatSnapshotFile(file: SnapshotFileState): string {
  return file.exists ? `file: ${file.path}` : `missing before: ${file.path}`;
}

function printInstructionContextDetails(
  phase: "pre" | "post",
  context: InstructionContext | undefined,
): void {
  if (!context) {
    return;
  }

  console.log(`    instruction_context: ${phase}`);
  const git = [
    context.git.branch,
    context.git.commit,
    context.git.dirty === undefined ? undefined : context.git.dirty ? "dirty" : "clean",
  ]
    .filter(Boolean)
    .join(" ");
  if (git) {
    console.log(`      git: ${git}`);
  }

  for (const file of context.files) {
    const hash = file.sha256 ? ` ${file.sha256.slice(0, 15)}` : "";
    const bytes = file.bytes === undefined ? "" : ` ${file.bytes} bytes`;
    console.log(`      ${file.path} ${file.status}${hash}${bytes}`);
  }

  for (const skill of context.skills) {
    const version = skill.version_or_sha256 ? ` ${skill.version_or_sha256.slice(0, 15)}` : "";
    console.log(`      skill ${skill.name} ${skill.status}${version}`);
  }

  for (const warning of context.warnings) {
    console.log(`      warning: ${warning}`);
  }
}

function printSnapshotRevertPlan(actions: SnapshotRevertAction[], dryRun: boolean): void {
  console.log(pc.cyan("Snapshot revert plan"));
  for (const action of actions) {
    if (action.type === "restore") {
      console.log(`${dryRun ? "Would restore" : "Restore"} ${action.path}`);
      continue;
    }

    console.log(`${dryRun ? "Would delete" : "Delete"} ${action.path}`);
  }
}

function formatSkillInstallSummary(
  result: SkillInstallResult,
  operation: SkillChangeOperation,
): string {
  return `${formatSkillChangeVerb(operation)} ${result.skillName} skill for ${formatAgentList(
    result.targets.map((target) => target.agent),
  )}`;
}

function formatSkillChangeVerb(operation: SkillChangeOperation): "Installed" | "Updated" {
  return operation === "install" ? "Installed" : "Updated";
}

function formatSkillInstallHistoryResult(result: SkillInstallResult): string {
  const targetStatuses = result.targets
    .map((target) => `${target.agent}:${target.status}`)
    .join(", ");
  const prehookStatuses = result.prehooks
    .map((prehook) => `${prehook.agent}:prehook:${prehook.status}`)
    .join(", ");
  return [targetStatuses, prehookStatuses].filter(Boolean).join("; ");
}

function printPostSkillChangeWelcome(result: SkillInstallResult): void {
  if (result.dryRun) {
    return;
  }

  console.log("");
  console.log(pc.green("Welcome to GetSuperpower."));
  console.log("Restart your agent IDE so it loads the latest skills.");
}

function formatAgentList(agents: string[]): string {
  return agents.join(", ");
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
  await buildProgram().parseAsync(process.argv);
}
