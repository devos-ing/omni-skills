#!/usr/bin/env bun

import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";
import { intro, isCancel, outro, select, text } from "@clack/prompts";
import { Command } from "commander";
import pc from "picocolors";
import {
  type CliStreamRunner,
  installAgentSkill,
  parseSkillInstallAgents,
  type SkillInstallResult,
} from "./plugins";
import {
  createOnboardingFiles,
  loadManifest,
  prepareGoalDiscussion,
  type RequirementCourtResult,
  runRequirementCourt,
  tallyVotes,
} from "./runtimes/goal-court";

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

export interface BuildProgramOptions {
  cwd?: string;
  streamRunner?: CliStreamRunner;
  clarificationPrompter?: GoalClarificationPrompter;
}

export function buildProgram(options: BuildProgramOptions = {}): Command {
  const rootDir = options.cwd ?? process.cwd();
  const clarificationPrompter = options.clarificationPrompter ?? promptForGoalClarifications;
  const program = new Command();

  program
    .name("goal-court")
    .description("Requirement-first runtime for supervising Codex, Claude, and other AI workers.")
    .version("0.1.0");

  program
    .command("onboard")
    .description("Create a local .goal-court manifest and onboarding files.")
    .option("-d, --dir <dir>", "target directory", rootDir)
    .option("-n, --name <name>", "project name")
    .option("-y, --yes", "use defaults without prompting", false)
    .action(async (commandOptions: { dir: string; name?: string; yes: boolean }) => {
      const targetDir = resolvePath(rootDir, commandOptions.dir);
      const projectName =
        commandOptions.name ??
        (commandOptions.yes
          ? basename(targetDir)
          : await promptForProjectName(basename(targetDir)));

      const result = await createOnboardingFiles({
        rootDir: targetDir,
        projectName,
      });

      console.log(pc.green("Goal Court onboarding complete"));
      console.log(pc.dim(`Manifest: ${result.manifestPath}`));
    });

  program
    .command("bots")
    .description("List bots from the manifest.")
    .option("-m, --manifest <path>", "manifest path", ".goal-court/manifest.json")
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
    .option("-m, --manifest <path>", "manifest path", ".goal-court/manifest.json")
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
    .option("-m, --manifest <path>", "manifest path", ".goal-court/manifest.json")
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
    .option("-m, --manifest <path>", "manifest path", ".goal-court/manifest.json")
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
  intro(pc.cyan("Goal Court onboarding"));
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

function resolvePath(rootDir: string, path: string): string {
  return isAbsolute(path) ? path : resolve(join(rootDir, path));
}

function configureSkillInstallCommand(command: Command, rootDir: string): Command {
  return command
    .argument("[source-or-name]", "bundled skill name or local skill directory", "pony-trail")
    .option(
      "-a, --agents <agents>",
      "comma-separated targets: claude,copilot,codex",
      "claude,copilot,codex",
    )
    .option("--home <dir>", "home directory that contains agent config folders", homedir())
    .option("--dry-run", "show install destinations without writing files", false)
    .option("--prehook", "also install a PonyTrail prehook reminder for file mutations", false)
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
        const result = await installAgentSkill({
          source: sourceOrName,
          cwd: rootDir,
          homeDir: resolveHomePath(commandOptions.home),
          agents: parseSkillInstallAgents(commandOptions.agents),
          dryRun: commandOptions.dryRun,
          force: commandOptions.force,
          installPrehook: commandOptions.prehook,
        });

        printSkillInstallResult(result);
      },
    );
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

function printSkillInstallResult(result: SkillInstallResult): void {
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

if (import.meta.main) {
  await buildProgram().parseAsync(process.argv);
}
