#!/usr/bin/env bun

import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";
import { confirm, intro, isCancel, outro, select, text } from "@clack/prompts";
import { Command } from "commander";
import pc from "picocolors";
import {
  type CliStreamRunner,
  installAgentSkill,
  parseSkillInstallAgents,
  type SkillInstallResult,
} from "./plugins";
import {
  applySnapshotRevert,
  createOnboardingFiles,
  type InstructionContext,
  loadManifest,
  planSnapshotRevert,
  prepareGoalDiscussion,
  type RecordedSnapshotCommit,
  type RequirementCourtResult,
  readSnapshotHistory,
  recordSnapshotPost,
  recordSnapshotPre,
  runRequirementCourt,
  type SnapshotCommit,
  type SnapshotFileState,
  type SnapshotRevertAction,
  tallyVotes,
} from "./runtimes/ponytrail";

export type ClarificationMode = "custom" | "open_question" | "skip";

export interface GoalClarificationAnswer {
  question: string;
  mode: ClarificationMode;
  answer: string;
}

export interface GoalClarificationPromptInput {
  request: string;
  questions: string[];
}

export interface GoalClarificationPromptResult {
  answers: GoalClarificationAnswer[];
}

export type GoalClarificationPrompter = (
  input: GoalClarificationPromptInput,
) => Promise<GoalClarificationPromptResult>;

export type ProjectNamePrompter = (defaultName: string) => Promise<string>;

export interface RevertApprovalPromptInput {
  snapshotId: string;
  actions: SnapshotRevertAction[];
}

export type RevertApprovalPrompter = (input: RevertApprovalPromptInput) => Promise<boolean>;

type SnapshotHistoryMode = "tree" | "details";

const defaultManifestPath = ".ponytrail/manifest.json";
const skillInstallHistorySessionId = "ponytrail-skills";

export interface BuildProgramOptions {
  cwd?: string;
  streamRunner?: CliStreamRunner;
  clarificationPrompter?: GoalClarificationPrompter;
  projectNamePrompter?: ProjectNamePrompter;
  revertApprovalPrompter?: RevertApprovalPrompter;
}

export function buildProgram(options: BuildProgramOptions = {}): Command {
  const rootDir = options.cwd ?? process.cwd();
  const clarificationPrompter = options.clarificationPrompter ?? promptForGoalClarifications;
  const projectNamePrompter = options.projectNamePrompter ?? promptForProjectName;
  const revertApprovalPrompter = options.revertApprovalPrompter ?? promptForRevertApproval;
  const program = new Command();

  program
    .name("ponytrail")
    .description("Requirement-first runtime for supervising Codex, Claude, and other AI workers.")
    .version("0.1.0");

  program
    .command("onboard")
    .description("Create local .ponytrail files and install the default Pony Trail skill.")
    .option("-d, --dir <dir>", "target directory", rootDir)
    .option("-n, --name <name>", "project name")
    .option(
      "-a, --agents <agents>",
      "comma-separated skill install targets: claude,copilot,codex",
      "claude,copilot,codex",
    )
    .option("--home <dir>", "home directory that contains agent config folders", homedir())
    .action(
      async (commandOptions: { dir: string; name?: string; agents: string; home: string }) => {
        const targetDir = resolvePath(rootDir, commandOptions.dir);
        const projectName = commandOptions.name ?? (await projectNamePrompter(basename(targetDir)));

        const result = await createOnboardingFiles({
          rootDir: targetDir,
          projectName,
        });

        console.log(pc.green("Ponytrail onboarding complete"));
        console.log(pc.dim(`Manifest: ${result.manifestPath}`));

        const skillResult = await installSkillWithLocalHistory({
          rootDir: targetDir,
          source: "pony-trail",
          homeDir: resolveHomePath(commandOptions.home),
          agents: parseSkillInstallAgents(commandOptions.agents),
          dryRun: false,
          force: false,
          installPrehook: false,
        });

        printSkillInstallResult(skillResult.skillInstall, skillResult.history);
      },
    );

  program
    .command("bots")
    .description("List bots from the manifest.")
    .option("-m, --manifest <path>", "manifest path", defaultManifestPath)
    .action(async (commandOptions: { manifest: string }) => {
      const manifest = await loadManifest(resolvePath(rootDir, commandOptions.manifest));

      for (const bot of manifest.bots) {
        const panel = bot.panel ? pc.dim(` (${bot.panel})`) : "";
        const model = pc.dim(` [model: ${bot.model}]`);
        console.log(`${pc.cyan(bot.id)} ${bot.displayName}${panel}${model}`);
      }
    });

  program
    .command("goal")
    .description("Clarify, discuss, and summarize a requirement-first goal.")
    .argument("<request...>", "raw goal request")
    .option("-m, --manifest <path>", "manifest path", defaultManifestPath)
    .option("-w, --worker <id>", "accepted for compatibility; worker execution is gated")
    .option("--json", "print JSON output", false)
    .action(
      async (
        requestParts: string[],
        commandOptions: { manifest: string; worker?: string; json: boolean },
      ) => {
        await runGoalFlow(requestParts, {
          rootDir,
          clarificationPrompter,
          manifestPath: commandOptions.manifest,
          printJson: commandOptions.json,
        });
      },
    );

  program
    .command("vote")
    .description("Apply the manifest decision rule to a JSON array of bot votes.")
    .option("-m, --manifest <path>", "manifest path", defaultManifestPath)
    .requiredOption("--votes <json>", "JSON array of bot votes")
    .option("--json", "print JSON output", false)
    .action(async (commandOptions: { manifest: string; votes: string; json: boolean }) => {
      const manifest = await loadManifest(resolvePath(rootDir, commandOptions.manifest));
      const votes = JSON.parse(commandOptions.votes);
      const verdict = tallyVotes(votes, manifest.deliberation.decisionRule);

      if (commandOptions.json) {
        console.log(JSON.stringify(verdict, null, 2));
        return;
      }

      console.log(verdict.approved ? pc.green("approved") : pc.yellow("not approved"));
      console.log(`${pc.dim("Approvals:")} ${verdict.approvals}`);
      console.log(`${pc.dim("Missing voters:")} ${verdict.missingVoters.join(", ") || "none"}`);
      if (verdict.requiredChanges.length > 0) {
        console.log(pc.dim("Required changes:"));
        for (const change of verdict.requiredChanges) {
          console.log(`- ${change}`);
        }
      }
    });

  program
    .command("stream-goal")
    .description("Compatibility alias for goal.")
    .argument("<request...>", "raw goal request")
    .option("-m, --manifest <path>", "manifest path", defaultManifestPath)
    .option("-w, --worker <id>", "accepted for compatibility; worker execution is gated")
    .action(
      async (requestParts: string[], commandOptions: { manifest: string; worker?: string }) => {
        await runGoalFlow(requestParts, {
          rootDir,
          clarificationPrompter,
          manifestPath: commandOptions.manifest,
          printJson: false,
        });
      },
    );

  program
    .command("history")
    .description("Show Pony Trail snapshot history.")
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
    .description("Restore files from a Pony Trail snapshot pre-state.")
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

  const skillsCommand = program.command("skills").description("Manage agent skills.");

  configureSkillInstallCommand(
    skillsCommand
      .command("install")
      .description("Install a bundled or local skill for Claude, GitHub Copilot, and Codex."),
    rootDir,
  );

  return program;
}

async function promptForProjectName(defaultName: string): Promise<string> {
  intro(pc.cyan("Ponytrail onboarding"));
  const answer = await text({
    message: "Project name",
    placeholder: defaultName,
    defaultValue: defaultName,
  });

  if (isCancel(answer)) {
    throw new Error("Onboarding cancelled");
  }

  outro(pc.green("Creating runtime files"));
  return String(answer);
}

interface RunGoalFlowInput {
  rootDir: string;
  clarificationPrompter: GoalClarificationPrompter;
  manifestPath: string;
  printJson: boolean;
}

async function runGoalFlow(requestParts: string[], input: RunGoalFlowInput): Promise<void> {
  const manifest = await loadManifest(resolvePath(input.rootDir, input.manifestPath));
  const request = requestParts.join(" ");
  const preparedDiscussion = prepareGoalDiscussion(request, { manifest });

  if (preparedDiscussion.status === "needs_clarification") {
    if (input.printJson) {
      console.log(JSON.stringify(preparedDiscussion, null, 2));
      return;
    }

    console.log(pc.yellow("Needs clarification"));
    for (const question of preparedDiscussion.brainstorm.questions) {
      console.log(`- ${question}`);
    }

    const clarification = await input.clarificationPrompter({
      request: preparedDiscussion.brainstorm.normalizedRequest,
      questions: preparedDiscussion.brainstorm.questions,
    });
    const clarifiedRequest = buildClarifiedRequest(clarification.answers);

    if (!clarifiedRequest) {
      console.log(pc.dim("Goal paused until the missing details are answered."));
      return;
    }

    const clarifiedDiscussion = prepareGoalDiscussion(clarifiedRequest, { manifest });

    if (clarifiedDiscussion.status === "needs_clarification") {
      console.log(pc.dim("Goal still needs more detail before a worker starts."));
      for (const question of clarifiedDiscussion.brainstorm.questions) {
        console.log(`- ${question}`);
      }
      return;
    }

    printRequirementCourtResult(runRequirementCourt(clarifiedDiscussion.contract, { manifest }));
    return;
  }

  if (input.printJson) {
    console.log(JSON.stringify(preparedDiscussion.contract, null, 2));
    return;
  }

  printRequirementCourtResult(runRequirementCourt(preparedDiscussion.contract, { manifest }));
}

function printRequirementCourtResult(result: RequirementCourtResult): void {
  console.log(pc.cyan("Requirement discussion"));
  for (const entry of result.discussion) {
    console.log(entry.line);
  }

  console.log("");
  console.log(pc.cyan("Judge summary"));
  console.log(result.judge.summary);

  console.log("");
  console.log(pc.cyan("Detailed requirement"));
  console.log(`Title: ${result.detailedRequirement.title}`);
  console.log(`Intent: ${result.detailedRequirement.intent}`);
  printList("Acceptance criteria", result.detailedRequirement.acceptanceCriteria);
  printList("Evidence required", result.detailedRequirement.evidenceRequired);
  printList("Risks", result.detailedRequirement.risks);
  console.log(`Human confirmation: ${result.humanConfirmation}`);
}

function printList(label: string, values: string[]): void {
  if (values.length === 0) {
    return;
  }

  console.log(`${label}:`);
  for (const value of values) {
    console.log(`- ${value}`);
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

function buildClarifiedRequest(answers: GoalClarificationAnswer[]): string | null {
  const customAnswers = answers
    .filter((answer) => answer.mode === "custom" && answer.answer.trim())
    .map((answer) => `${answer.question} ${answer.answer.trim()}`);

  if (customAnswers.length === 0) {
    return null;
  }

  return ["Clarified goal details.", ...customAnswers].join(" ");
}

async function promptForGoalClarifications(
  input: GoalClarificationPromptInput,
): Promise<GoalClarificationPromptResult> {
  if (!process.stdin.isTTY) {
    return { answers: [] };
  }

  intro(pc.cyan("Goal clarification"));
  const answers: GoalClarificationAnswer[] = [];

  for (const question of input.questions) {
    const mode = await select({
      message: question,
      options: [
        {
          value: "custom",
          label: "Custom answer",
          hint: "Write the missing detail now.",
        },
        {
          value: "open_question",
          label: "Keep open",
          hint: "Leave this as an open question.",
        },
        {
          value: "skip",
          label: "Skip",
          hint: "Continue without this detail.",
        },
      ],
    });

    if (isCancel(mode)) {
      throw new Error("Goal clarification cancelled");
    }

    if (mode !== "custom") {
      answers.push({ question, mode, answer: "" });
      continue;
    }

    const answer = await text({
      message: "Custom answer",
      placeholder: input.request,
    });

    if (isCancel(answer)) {
      throw new Error("Goal clarification cancelled");
    }

    answers.push({ question, mode: "custom", answer: String(answer) });
  }

  outro(pc.green("Goal details captured"));
  return { answers };
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

function resolvePath(rootDir: string, path: string): string {
  return isAbsolute(path) ? path : resolve(join(rootDir, path));
}

function configureSkillInstallCommand(command: Command, rootDir: string): Command {
  return command
    .argument("[source-or-name]", "bundled skill name or local skill directory", "pony-trail")
    .option(
      "-a, --agents <agents>",
      "comma-separated targets: claude,copilot,codex,cursor",
      "claude,copilot,codex,cursor",
    )
    .option("--home <dir>", "home directory that contains agent config folders", homedir())
    .option("--dry-run", "show install destinations without writing files", false)
    .option("--prehook", "also install a Ponytrail prehook reminder for file mutations", false)
    .option("-f, --force", "overwrite existing installed skill folders", false)
    .action(
      async (
        sourceOrName: string,
        commandOptions: {
          agents: string;
          home: string;
          dryRun: boolean;
          prehook: boolean;
          force: boolean;
        },
      ) => {
        const result = await installSkillWithLocalHistory({
          rootDir,
          source: sourceOrName,
          homeDir: resolveHomePath(commandOptions.home),
          agents: parseSkillInstallAgents(commandOptions.agents),
          dryRun: commandOptions.dryRun,
          force: commandOptions.force,
          installPrehook: commandOptions.prehook,
        });

        printSkillInstallResult(result.skillInstall, result.history);
      },
    );
}

interface InstallSkillWithLocalHistoryInput {
  rootDir: string;
  source: string;
  homeDir: string;
  agents: ReturnType<typeof parseSkillInstallAgents>;
  dryRun: boolean;
  force: boolean;
  installPrehook: boolean;
}

interface InstallSkillWithLocalHistoryResult {
  skillInstall: SkillInstallResult;
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
      idPrefix: "skill-install",
      action: "install skill",
      purpose: `Install ${input.source} skill for ${formatAgentList(input.agents)}`,
      reason: "Keep project-local history before changing agent skill files.",
      expected: "The skill install result is captured in local Ponytrail history.",
      verify: "ponytrail history --details",
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
      installPrehook: input.installPrehook,
    });

    if (history) {
      history = await recordSnapshotPost({
        rootDir: input.rootDir,
        sessionId: history.sessionId,
        snapshotId: history.snapshotId,
        summary: formatSkillInstallSummary(skillInstall),
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
        summary: `Failed to install ${input.source} skill for ${formatAgentList(input.agents)}`,
        checks: commandText,
        result: `fail: ${formatErrorMessage(error)}`,
      });
    }
    throw error;
  }
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
): void {
  console.log(pc.cyan(result.dryRun ? "Skill install plan" : "Skill install result"));
  console.log(`Skill: ${result.skillName}`);
  console.log(`${pc.dim("Source:")} ${result.source.path}`);

  for (const target of result.targets) {
    console.log(
      `${target.agent}: ${formatSkillInstallStatus(target.status)} ${pc.dim(target.destination)}`,
    );
  }

  if (result.prehooks.length > 0) {
    console.log("");
    console.log(pc.cyan(result.dryRun ? "Prehook install plan" : "Prehook install result"));
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
  return ["ponytrail skills install", input.source, ...flags].join(" ");
}

function formatSkillInstallSummary(result: SkillInstallResult): string {
  return `Installed ${result.skillName} skill for ${formatAgentList(
    result.targets.map((target) => target.agent),
  )}`;
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

function formatAgentList(agents: string[]): string {
  return agents.join(", ");
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
  await buildProgram().parseAsync(process.argv);
}
