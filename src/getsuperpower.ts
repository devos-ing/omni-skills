import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { cancel as clackCancel, confirm as clackConfirm, isCancel } from "@clack/prompts";
import type { Command } from "commander";
import {
  commandText,
  getSuperpowerInstallResultBox,
  keyValue,
  muted,
  nextStep,
  success,
  warning,
} from "./cli-theme";
import {
  MissingMattPocockSkillError,
  MissingSuperpowersSkillError,
  parseSkillInstallAgents,
  type SkillInstallResult,
} from "./plugins";
import { runSubprocess } from "./process";
import {
  createWorkflowBundleScaffold,
  getPreparedWorkflowSkillInstallDependencies,
  installWorkflowBundle,
  listInstalledWorkflowBundles,
  loadWorkflowBundle,
  type WorkflowGitCommandRunner,
} from "./runtimes/getsuperpower";

export interface GetSuperpowerInstallSkillInput {
  rootDir: string;
  operation: "install";
  source: string;
  homeDir: string;
  agents: ReturnType<typeof parseSkillInstallAgents>;
  dryRun: false;
  force: false;
  refreshExisting: true;
  installPrehook: false;
}

export interface GetSuperpowerInstallSkillResult {
  skillInstall: SkillInstallResult;
}

export type GetSuperpowerSkillInstaller = (
  input: GetSuperpowerInstallSkillInput,
) => Promise<GetSuperpowerInstallSkillResult>;

export interface GetSuperpowerSkillInstallPrintOptions {
  showPostSkillChangeWelcome?: boolean;
}

export type GetSuperpowerSkillInstallPrinter = (
  result: SkillInstallResult,
  operation: "install",
  options: GetSuperpowerSkillInstallPrintOptions,
) => void;

export interface GetSuperpowerExternalSkillDependencyInstallInput {
  source: string;
  repo?: string;
  homeDir: string;
  runCommand?: GetSuperpowerExternalSkillCommandRunner;
}

export type GetSuperpowerExternalSkillDependencyInstaller = (
  input: GetSuperpowerExternalSkillDependencyInstallInput,
) => Promise<void>;

export interface GetSuperpowerExternalSkillCommand {
  executable: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
}

export interface GetSuperpowerExternalSkillCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type GetSuperpowerExternalSkillCommandRunner = (
  command: GetSuperpowerExternalSkillCommand,
) => Promise<GetSuperpowerExternalSkillCommandResult>;

export interface GetSuperpowerOnboardPrompt {
  confirm(input: { message: string; defaultValue: boolean }): Promise<boolean>;
}

export interface GetSuperpowerInstallSkillPlan {
  source: string;
  repo?: string | undefined;
}

export interface GetSuperpowerInstallPromptInput {
  workflowName: string;
  workflowVersion: string;
  skills: GetSuperpowerInstallSkillPlan[];
  targetDir: string;
  homeDir: string;
  agents: ReturnType<typeof parseSkillInstallAgents>;
}

export interface GetSuperpowerInstallPrompt {
  confirmInstall(input: GetSuperpowerInstallPromptInput): Promise<boolean>;
}

export interface GetSuperpowerOnboardCommand {
  executable: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
}

export interface GetSuperpowerOnboardCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type GetSuperpowerOnboardCommandRunner = (
  command: GetSuperpowerOnboardCommand,
) => Promise<GetSuperpowerOnboardCommandResult>;

export interface ConfigureGetSuperpowerCommandOptions {
  rootDir: string;
  installSkill: GetSuperpowerSkillInstaller;
  printSkillInstallResult: GetSuperpowerSkillInstallPrinter;
  installExternalSkillDependency?: GetSuperpowerExternalSkillDependencyInstaller;
  installPrompt?: GetSuperpowerInstallPrompt;
  workflowGitCommandRunner?: WorkflowGitCommandRunner;
  onboardPrompt?: GetSuperpowerOnboardPrompt;
  onboardCommandRunner?: GetSuperpowerOnboardCommandRunner;
}

interface GetSuperpowerInstallCommandOptions {
  dir?: string;
  agents: string;
  home: string;
}

type GetSuperpowerLoopCommandName = "start" | "status" | "log" | "advance" | "summary";

interface GetSuperpowerLoopCommandOptions {
  home: string;
  run?: string;
  latest?: boolean;
  json?: boolean;
  type?: string;
  step?: string;
  message?: string;
  metadata?: string;
  to?: string;
  force?: boolean;
  reason?: string;
}

interface WorkflowLoopRuntimeModule {
  runWorkflowLoopCli(input: {
    argv: string[];
    workflowJson: string;
    cwd: string;
    homeDir: string;
    commandPrefix: (command: string) => string;
  }): Promise<number>;
}

export function configureGetSuperpowerCommand(
  program: Command,
  options: ConfigureGetSuperpowerCommandOptions,
): Command {
  configureGetSuperpowerCommands(program, options);

  const bundleCommand = program
    .command("bundle")
    .description("Compatibility alias for GetSuperpower authoring.");
  configureAuthorCommands(bundleCommand, options);

  const workflowCommand = program
    .command("workflow")
    .description("Compatibility alias for GetSuperpower install and list commands.");
  configureInstallCommand(workflowCommand, options);
  configureListCommand(workflowCommand, options.rootDir);

  return program;
}

function configureGetSuperpowerCommands(
  command: Command,
  options: ConfigureGetSuperpowerCommandOptions,
): void {
  configureAuthorCommands(command, options);
  configureInstallCommand(command, options);
  configureListCommand(command, options.rootDir);
  configureDependencyCommand(command, options);
  configureOnboardCommand(command, options);
  configureLoopCommand(command, options);
}

function configureAuthorCommands(
  command: Command,
  options: ConfigureGetSuperpowerCommandOptions,
): void {
  command
    .command("init")
    .description("Create a local GetSuperpower scaffold.")
    .argument("<name>", "GetSuperpower name")
    .option("--dir <dir>", "directory that will contain the GetSuperpower", options.rootDir)
    .action(async (name: string, commandOptions: { dir: string }) => {
      const scaffold = await createWorkflowBundleScaffold({
        rootDir: resolvePath(options.rootDir, commandOptions.dir),
        name,
      });

      console.log(success(`GetSuperpower created: ${scaffold.bundleDir}`));
      console.log(keyValue("Manifest", scaffold.manifestPath));
      console.log(keyValue("README", scaffold.readmePath));
    });

  command
    .command("validate")
    .description("Validate a GetSuperpower manifest.")
    .argument("<path>", "GetSuperpower directory or workflow.json path")
    .action(async (path: string) => {
      const bundle = await loadWorkflowBundle(path, {
        cwd: options.rootDir,
        ...(options.workflowGitCommandRunner
          ? { runGitCommand: options.workflowGitCommandRunner }
          : {}),
      });
      try {
        console.log(
          success(`GetSuperpower valid: ${bundle.manifest.name}@${bundle.manifest.version}`),
        );
        console.log(keyValue("Steps", String(bundle.manifest.steps.length)));
        console.log(keyValue("Skills", String(bundle.manifest.skills.length)));
      } finally {
        await bundle.cleanup?.();
      }
    });
}

function configureInstallCommand(
  command: Command,
  options: ConfigureGetSuperpowerCommandOptions,
): void {
  command
    .command("install")
    .description("Install a GetSuperpower and its skills.")
    .argument(
      "<source>",
      "workflow alias, local GetSuperpower path, workflow.json path, or public git source",
    )
    .option("--dir <dir>", "override directory that receives .getsuperpower/workflows")
    .option(
      "--agents <agents>",
      "comma-separated skill install targets: codex,claude,cursor,copilot,opencode (aliases: github-copilot,opencodex)",
      "codex,claude,cursor",
    )
    .option(
      "--home <dir>",
      "home directory for global GetSuperpower records and agent config folders",
      homedir(),
    )
    .action((source: string, commandOptions: GetSuperpowerInstallCommandOptions) =>
      runGetSuperpowerInstall(source, commandOptions, options),
    );
}

async function runGetSuperpowerInstall(
  source: string,
  commandOptions: GetSuperpowerInstallCommandOptions,
  options: ConfigureGetSuperpowerCommandOptions,
): Promise<void> {
  const homeDir = resolveHomePath(commandOptions.home);
  const targetDir = commandOptions.dir ? resolvePath(options.rootDir, commandOptions.dir) : homeDir;
  const bundle = await loadWorkflowBundle(source, {
    cwd: options.rootDir,
    ...(options.workflowGitCommandRunner
      ? { runGitCommand: options.workflowGitCommandRunner }
      : {}),
  });
  const installAgents = parseSkillInstallAgents(commandOptions.agents);
  const installedExternalPackages = new Set<string>();
  const skillPlans = getWorkflowInstallSkillPlans(bundle);
  const installPrompt = options.installPrompt ?? createDefaultInstallPrompt();
  let preparedDependencies:
    | Awaited<ReturnType<typeof getPreparedWorkflowSkillInstallDependencies>>
    | undefined;

  try {
    printGetSuperpowerInstallPlan({
      workflowName: bundle.manifest.name,
      workflowVersion: bundle.manifest.version,
      skills: skillPlans,
      targetDir,
      homeDir,
    });

    const approved = await installPrompt.confirmInstall({
      workflowName: bundle.manifest.name,
      workflowVersion: bundle.manifest.version,
      skills: skillPlans,
      targetDir,
      homeDir,
      agents: installAgents,
    });

    if (!approved) {
      console.log(warning("GetSuperpower install cancelled."));
      return;
    }

    console.log(success("Installing skills..."));

    preparedDependencies = await getPreparedWorkflowSkillInstallDependencies({ bundle });
    const skillDependencies = preparedDependencies.dependencies;
    for (const [index, skillDependency] of skillDependencies.entries()) {
      const displaySkill = skillPlans[index]?.source ?? skillDependency.source;
      console.log(`Processing ${index + 1}/${skillDependencies.length}: ${displaySkill}`);
      const skillResult = await installGetSuperpowerSkillDependency({
        rootDir: targetDir,
        source: skillDependency.source,
        ...(skillDependency.repo ? { repo: skillDependency.repo } : {}),
        homeDir,
        agents: installAgents,
        installSkill: options.installSkill,
        installExternalSkillDependency:
          options.installExternalSkillDependency ?? installExternalSkillDependencyWithSkillsCli,
        installedExternalPackages,
      });

      options.printSkillInstallResult(skillResult.skillInstall, "install", {
        showPostSkillChangeWelcome: false,
      });
      console.log(success(`Installed skill: ${skillResult.skillInstall.skillName}`));
    }

    const install = await installWorkflowBundle({ rootDir: targetDir, bundle });

    console.log(success(`GetSuperpower installed: ${install.workflow.name}`));
    console.log(keyValue("GetSuperpower file", install.path));
    console.log(
      getSuperpowerInstallResultBox({
        workflowName: install.workflow.name,
        workflowVersion: install.workflow.version,
        workflowFile: install.path,
        skillCount: skillDependencies.length,
      }),
    );
  } finally {
    await preparedDependencies?.cleanup?.();
    await bundle.cleanup?.();
  }
}

function getWorkflowInstallSkillPlans(bundle: {
  manifest: { skills: GetSuperpowerInstallSkillPlan[] };
}): GetSuperpowerInstallSkillPlan[] {
  return bundle.manifest.skills.map((skill) => ({
    source: skill.source,
    ...(skill.repo ? { repo: skill.repo } : {}),
  }));
}

function printGetSuperpowerInstallPlan(input: {
  workflowName: string;
  workflowVersion: string;
  skills: GetSuperpowerInstallSkillPlan[];
  targetDir: string;
  homeDir: string;
}): void {
  console.log(
    success(`GetSuperpower install plan: ${input.workflowName}@${input.workflowVersion}`),
  );
  console.log(keyValue("Workflow records", input.targetDir));
  console.log(keyValue("Skill home", input.homeDir));
  console.log("Skills to install:");
  for (const skill of input.skills) {
    console.log(`- ${formatInstallSkillPlan(skill)}`);
  }
}

function formatInstallSkillPlan(skill: GetSuperpowerInstallSkillPlan): string {
  return skill.repo ? `${skill.source} (${skill.repo})` : skill.source;
}

async function installGetSuperpowerSkillDependency(input: {
  rootDir: string;
  source: string;
  repo?: string;
  homeDir: string;
  agents: ReturnType<typeof parseSkillInstallAgents>;
  installSkill: GetSuperpowerSkillInstaller;
  installExternalSkillDependency: GetSuperpowerExternalSkillDependencyInstaller;
  installedExternalPackages: Set<string>;
}): Promise<GetSuperpowerInstallSkillResult> {
  try {
    return await installWorkflowSkillDependency(input);
  } catch (error) {
    const externalPackage = getSkillsCliPackageForMissingDependency(
      input.source,
      input.repo,
      error,
    );
    if (!externalPackage) {
      throw error;
    }

    const externalInstallKey =
      getSkillsCliInstallKeyForSource(input.source, input.repo) ?? externalPackage;

    if (!input.installedExternalPackages.has(externalInstallKey)) {
      console.log(keyValue("Installing external skill dependency", externalPackage));
      await input.installExternalSkillDependency({
        source: input.source,
        ...(input.repo ? { repo: input.repo } : {}),
        homeDir: input.homeDir,
      });
      input.installedExternalPackages.add(externalInstallKey);
    }

    try {
      return await installWorkflowSkillDependency(input);
    } catch (retryError) {
      if (isMissingBootstrappableSkillError(retryError)) {
        throw new Error(
          `The skills CLI ran for ${externalPackage}, but ${input.source} is still missing. ${retryError.message}`,
        );
      }
      throw retryError;
    }
  }
}

function installWorkflowSkillDependency(input: {
  rootDir: string;
  source: string;
  homeDir: string;
  agents: ReturnType<typeof parseSkillInstallAgents>;
  installSkill: GetSuperpowerSkillInstaller;
}): Promise<GetSuperpowerInstallSkillResult> {
  return input.installSkill({
    rootDir: input.rootDir,
    operation: "install",
    source: input.source,
    homeDir: input.homeDir,
    agents: input.agents,
    dryRun: false,
    force: false,
    refreshExisting: true,
    installPrehook: false,
  });
}

function getSkillsCliPackageForMissingDependency(
  source: string,
  repo: string | undefined,
  error: unknown,
): string | null {
  if (!isMissingBootstrappableSkillError(error)) {
    return null;
  }

  return getSkillsCliPackageForDependency(source, repo);
}

function isMissingBootstrappableSkillError(
  error: unknown,
): error is MissingMattPocockSkillError | MissingSuperpowersSkillError {
  return (
    error instanceof MissingMattPocockSkillError || error instanceof MissingSuperpowersSkillError
  );
}

export function getSkillsCliPackageForSource(source: string): string | null {
  if (isBareSkillsCliPackage(source)) {
    return source;
  }

  if (source.startsWith("superpowers:")) {
    return "obra/superpowers";
  }

  if (source.startsWith("mattpocock:")) {
    return "mattpocock/skills";
  }

  const githubPrefix = "github:";
  if (!source.startsWith(githubPrefix)) {
    return null;
  }

  const [owner, repo] = source.slice(githubPrefix.length).split("/");
  if (!owner || !repo) {
    return null;
  }

  return `${owner}/${repo}`;
}

function getSkillsCliPackageForDependency(source: string, repo: string | undefined): string | null {
  return normalizeSkillsCliRepoSource(repo) ?? getSkillsCliPackageForSource(source);
}

function normalizeSkillsCliRepoSource(repo: string | undefined): string | null {
  const trimmed = repo?.trim();
  if (!trimmed) {
    return null;
  }

  const markdownLinkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(trimmed);
  if (!markdownLinkMatch) {
    return trimmed;
  }

  const label = markdownLinkMatch[1]?.trim();
  const url = markdownLinkMatch[2]?.trim();
  if (label && isBareSkillsCliPackage(label)) {
    return label;
  }

  return url || null;
}

function getSkillsCliInstallKeyForSource(source: string, repo?: string): string | null {
  const skillName = getSkillsCliSkillNameForSource(source);
  if (!skillName) {
    return getSkillsCliPackageForDependency(source, repo);
  }

  const packageName = getSkillsCliPackageForDependency(source, repo);
  return packageName ? `${packageName}:${skillName}` : null;
}

function getSkillsCliSkillNameForSource(source: string): string | null {
  if (source.startsWith("superpowers:")) {
    return source.slice("superpowers:".length).trim() || null;
  }

  if (source.startsWith("mattpocock:")) {
    return source.slice("mattpocock:".length).trim() || null;
  }

  const mattPocockGithubPrefix = "github:mattpocock/skills/";
  if (source.startsWith(mattPocockGithubPrefix)) {
    const suffix = source.slice(mattPocockGithubPrefix.length);
    const skillPath = suffix.startsWith("skills/") ? suffix.slice("skills/".length) : suffix;
    return skillPath.trim() || null;
  }

  return null;
}

function isBareSkillsCliPackage(source: string): boolean {
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(source);
}

export async function installExternalSkillDependencyWithSkillsCli(
  input: GetSuperpowerExternalSkillDependencyInstallInput,
): Promise<void> {
  const packageName = getSkillsCliPackageForDependency(input.source, input.repo);
  if (!packageName) {
    throw new Error(`No skills CLI package is known for dependency: ${input.source}`);
  }

  const args = ["--yes", "skills@latest", "add", packageName, "--yes", "--global"];
  const skillName = getSkillsCliSkillNameForSource(input.source);
  if (skillName) {
    args.push("--skill", skillName, "--agent", "codex");
  }

  const result = await (input.runCommand ?? runExternalSkillCommand)({
    executable: "npx",
    args,
    cwd: input.homeDir,
    env: {
      ...process.env,
      HOME: input.homeDir,
    },
  });

  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
  if (result.stderr.trim()) {
    console.error(result.stderr.trim());
  }
  if (result.exitCode !== 0) {
    throw new Error(`skills CLI failed while installing ${packageName} (exit ${result.exitCode})`);
  }
}

async function runExternalSkillCommand(
  command: GetSuperpowerExternalSkillCommand,
): Promise<GetSuperpowerExternalSkillCommandResult> {
  return runSubprocess(command);
}

function configureListCommand(command: Command, rootDir: string): void {
  command
    .command("list")
    .description("List installed GetSuperpowers.")
    .option("--dir <dir>", "override directory with .getsuperpower/workflows")
    .option("--home <dir>", "home directory that contains global GetSuperpower records", homedir())
    .action(async (commandOptions: { dir?: string; home: string }) => {
      const targetDir = commandOptions.dir
        ? resolvePath(rootDir, commandOptions.dir)
        : resolveHomePath(commandOptions.home);
      const workflows = await listInstalledWorkflowBundles({
        rootDir: targetDir,
      });

      if (workflows.length === 0) {
        console.log(muted("No GetSuperpowers installed."));
        console.log(nextStep("getsuperpower install <path-or-git-url>"));
        return;
      }

      for (const workflow of workflows) {
        console.log(`${workflow.name} ${workflow.version}`);
      }
    });
}

function configureDependencyCommand(
  command: Command,
  options: ConfigureGetSuperpowerCommandOptions,
): void {
  command
    .command("deps")
    .aliases(["dependencies", "dependence"])
    .description("List the skill dependencies declared by a GetSuperpower.")
    .argument("<source>", "local GetSuperpower path, workflow.json path, or public git source")
    .action(async (source: string) => {
      const bundle = await loadWorkflowBundle(source, {
        cwd: options.rootDir,
        ...(options.workflowGitCommandRunner
          ? { runGitCommand: options.workflowGitCommandRunner }
          : {}),
      });
      try {
        console.log(success(`GetSuperpower dependencies: ${bundle.manifest.name}`));
        for (const skill of bundle.manifest.skills) {
          const optional = skill.optional ? " (optional)" : "";
          console.log(`- ${skill.source}${optional}`);
        }
      } finally {
        await bundle.cleanup?.();
      }
    });
}

function configureLoopCommand(
  command: Command,
  options: ConfigureGetSuperpowerCommandOptions,
): void {
  const loopCommand = command.command("loop").description("Control looped workflow runs.");

  configureLoopSubcommand(loopCommand, "start", "Start a looped workflow run.", options)
    .option("--run <id>", "run id to create")
    .option("--json", "print JSON output", false);

  configureLoopSubcommand(loopCommand, "status", "Show looped workflow run status.", options)
    .option("--run <id>", "run id to inspect")
    .option("--latest", "select the latest active run", false)
    .option("--json", "print JSON output", false);

  configureLoopSubcommand(loopCommand, "log", "Append a structured loop event.", options)
    .option("--run <id>", "run id to append to")
    .option("--type <event-type>", "structured event type")
    .option("--step <step-id>", "override the event step id")
    .option("--message <message>", "event message")
    .option("--metadata <json>", "event metadata as JSON")
    .option("--json", "print JSON output", false);

  configureLoopSubcommand(loopCommand, "advance", "Advance a looped workflow run.", options)
    .option("--run <id>", "run id to advance")
    .option("--to <step-id>", "force advancement to a specific step")
    .option("--force", "allow forced advancement when paired with --reason", false)
    .option("--reason <reason>", "reason for forced advancement")
    .option("--json", "print JSON output", false);

  configureLoopSubcommand(loopCommand, "summary", "Write a looped workflow run summary.", options)
    .option("--run <id>", "run id to summarize")
    .option("--latest", "select the latest active run", false)
    .option("--json", "print JSON output", false);
}

function configureLoopSubcommand(
  command: Command,
  name: GetSuperpowerLoopCommandName,
  description: string,
  options: ConfigureGetSuperpowerCommandOptions,
): Command {
  return command
    .command(name)
    .description(description)
    .argument(
      "<source>",
      "workflow alias, local GetSuperpower path, workflow.json path, or public git source",
    )
    .option("--home <dir>", "home directory for global GetSuperpower loop run state", homedir())
    .action((source: string, commandOptions: GetSuperpowerLoopCommandOptions) =>
      runGetSuperpowerLoop(name, source, commandOptions, options),
    );
}

async function runGetSuperpowerLoop(
  command: GetSuperpowerLoopCommandName,
  source: string,
  commandOptions: GetSuperpowerLoopCommandOptions,
  options: ConfigureGetSuperpowerCommandOptions,
): Promise<void> {
  const homeDir = resolveHomePath(commandOptions.home);
  const bundle = await loadWorkflowBundle(source, {
    cwd: options.rootDir,
    ...(options.workflowGitCommandRunner
      ? { runGitCommand: options.workflowGitCommandRunner }
      : {}),
  });

  try {
    if (!bundle.manifest.loop) {
      throw new Error(`GetSuperpower is not loop-enabled: ${bundle.manifest.name}`);
    }

    const { runWorkflowLoopCli } = (await importWorkflowLoopRuntime()) as WorkflowLoopRuntimeModule;
    const exitCode = await runWorkflowLoopCli({
      argv: buildLoopRuntimeArgs(command, commandOptions),
      workflowJson: bundle.manifestPath,
      cwd: options.rootDir,
      homeDir,
      commandPrefix: (loopCommand) => `getsuperpower loop ${loopCommand} ${quoteShellArg(source)}`,
    });

    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  } finally {
    await bundle.cleanup?.();
  }
}

async function importWorkflowLoopRuntime(): Promise<unknown> {
  const runtimeModulePath = "./runtimes/getsuperpower/workflow-loop-runtime.mjs";
  return import(runtimeModulePath);
}

function buildLoopRuntimeArgs(
  command: GetSuperpowerLoopCommandName,
  options: GetSuperpowerLoopCommandOptions,
): string[] {
  const args = [command];
  appendStringOption(args, "run", options.run);
  appendStringOption(args, "type", options.type);
  appendStringOption(args, "step", options.step);
  appendStringOption(args, "message", options.message);
  appendStringOption(args, "metadata", options.metadata);
  appendStringOption(args, "to", options.to);
  appendStringOption(args, "reason", options.reason);
  appendBooleanOption(args, "latest", options.latest);
  appendBooleanOption(args, "force", options.force);
  appendBooleanOption(args, "json", options.json);
  return args;
}

function appendStringOption(args: string[], name: string, value: string | undefined): void {
  if (value !== undefined) {
    args.push(`--${name}`, value);
  }
}

function appendBooleanOption(args: string[], name: string, value: boolean | undefined): void {
  if (value === true) {
    args.push(`--${name}`);
  }
}

function quoteShellArg(value: string): string {
  if (/^[a-zA-Z0-9_./:@#-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function configureOnboardCommand(
  command: Command,
  options: ConfigureGetSuperpowerCommandOptions,
): void {
  command
    .command("onboard")
    .description("Step through RTK and CodeGraph setup for this workspace.")
    .option("--dir <dir>", "project directory to onboard", options.rootDir)
    .action((commandOptions: { dir: string }) => runGetSuperpowerOnboard(commandOptions, options));
}

async function runGetSuperpowerOnboard(
  commandOptions: { dir: string },
  options: ConfigureGetSuperpowerCommandOptions,
): Promise<void> {
  const targetDir = resolvePath(options.rootDir, commandOptions.dir);
  if (!existsSync(targetDir)) {
    throw new Error(`Onboard target directory does not exist: ${targetDir}`);
  }

  const prompt = options.onboardPrompt ?? createDefaultOnboardPrompt();
  const runCommand = options.onboardCommandRunner ?? runExternalSkillCommand;

  console.log(success("GetSuperpower onboard"));
  console.log(keyValue("Workspace", targetDir));

  const rtkResult = await runCommand({
    executable: "rtk",
    args: ["--version"],
    cwd: targetDir,
    env: process.env,
  });

  if (rtkResult.exitCode === 0) {
    console.log(success("RTK ready"));
  } else if (
    await prompt.confirm({
      message: "RTK is not available. Show RTK setup guidance to reduce Codex token usage?",
      defaultValue: true,
    })
  ) {
    printRtkSetupGuidance();
  } else {
    console.log(warning("RTK setup skipped"));
  }

  const codegraphDir = join(targetDir, ".codegraph");
  if (existsSync(codegraphDir)) {
    console.log(success("CodeGraph ready"));
  } else if (
    await prompt.confirm({
      message: "CodeGraph is not initialized. Index this codebase with CodeGraph now?",
      defaultValue: true,
    })
  ) {
    await runCodeGraphInit({ targetDir, runCommand });
  } else {
    console.log(warning("CodeGraph setup skipped"));
  }

  console.log(success("GetSuperpower onboard complete"));
}

function printRtkSetupGuidance(): void {
  console.log(success("RTK setup guidance"));
  console.log("Install or enable RTK, then verify it with:");
  console.log(commandText("rtk --version"));
}

async function runCodeGraphInit(input: {
  targetDir: string;
  runCommand: GetSuperpowerOnboardCommandRunner;
}): Promise<void> {
  const result = await input.runCommand({
    executable: "codegraph",
    args: ["init", "-i"],
    cwd: input.targetDir,
    env: process.env,
  });

  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
    throw new Error(`CodeGraph setup failed while running codegraph init -i: ${detail}`);
  }

  console.log(success("CodeGraph indexed"));
}

function createDefaultOnboardPrompt(): GetSuperpowerOnboardPrompt {
  return {
    confirm: async (input) => {
      const result = await clackConfirm({
        message: input.message,
        initialValue: input.defaultValue,
      });

      if (isCancel(result)) {
        clackCancel("GetSuperpower onboard cancelled");
        throw new Error("GetSuperpower onboard cancelled");
      }

      return result;
    },
  };
}

function createDefaultInstallPrompt(): GetSuperpowerInstallPrompt {
  return {
    confirmInstall: async (input) => {
      if (!process.stdin.isTTY) {
        console.log(muted("Non-interactive shell detected; continuing with install."));
        return true;
      }

      const result = await clackConfirm({
        message: `Install ${input.skills.length} skills for ${input.workflowName}?`,
        initialValue: true,
      });

      if (isCancel(result)) {
        clackCancel("GetSuperpower install cancelled");
        return false;
      }

      return result;
    },
  };
}

function resolvePath(rootDir: string, path: string): string {
  return isAbsolute(path) ? path : resolve(join(rootDir, path));
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
