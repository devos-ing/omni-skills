#!/usr/bin/env node

import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { Command } from "commander";
import {
  keyValue,
  muted,
  rootHelpBanner,
  styleHelpTerm,
  styleHelpTitle,
  success,
} from "./cli-theme";
import {
  configureOmniskillCommand,
  getSkillsCliPackageForSource,
  installExternalSkillDependencyWithSkillsCli,
  type OmniskillExternalSkillDependencyInstaller,
} from "./omniskill";
import {
  createCodexModelCatalogProvider,
  installAgentSkill,
  parseSkillInstallAgents,
  type SkillInstallResult,
} from "./plugins";
import { runSubprocess } from "./process";

type SkillChangeOperation = "install" | "update";

const CLI_VERSION = "0.6.0";

interface CommanderVersionInternals {
  _outputConfiguration: {
    writeOut: (value: string) => void;
  };
  _exit: (exitCode: number, code: string, message: string) => never;
}

export interface BuildProgramOptions {
  cwd?: string;
  installExternalSkillDependency?: OmniskillExternalSkillDependencyInstaller;
}

export function buildProgram(options: BuildProgramOptions = {}): Command {
  const rootDir = options.cwd ?? process.cwd();
  const installExternalSkillDependency =
    options.installExternalSkillDependency ?? installExternalSkillDependencyWithSkillsCli;
  const program = new Command();

  program
    .name("omniskill")
    .description("Install, author, and inspect Omniskills skill trees.")
    .version(CLI_VERSION)
    .option("-v", "output the version number");
  program.configureHelp({
    styleTitle: styleHelpTitle,
    styleSubcommandTerm: styleHelpTerm,
    styleOptionTerm: styleHelpTerm,
  });
  program.addHelpText("before", rootHelpBanner);
  program.action(() => {
    program.help();
  });

  program.on("option:v", () => {
    outputVersionAndExit(program, CLI_VERSION);
  });

  configureOmniskillCommand(program, {
    rootDir,
    installSkill,
    printSkillInstallResult,
    installExternalSkillDependency,
    codexModelCatalog: createCodexModelCatalogProvider(runSubprocess),
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

function configureSkillInstallCommand(
  command: Command,
  rootDir: string,
  installExternalSkillDependency: OmniskillExternalSkillDependencyInstaller,
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
  installExternalSkillDependency?: OmniskillExternalSkillDependencyInstaller,
): Command {
  return command
    .argument(
      "[source-or-name]",
      "bundled skill name or local skill directory",
      "creating-bundle-skills",
    )
    .option(
      "-a, --agents <agents>",
      "comma-separated targets: claude,copilot,codex,cursor,hermes,openclaw,opencode (aliases: github-copilot,opencodex)",
      "claude,copilot,codex,cursor,hermes,openclaw,opencode",
    )
    .option("--home <dir>", "home directory that contains agent config folders", homedir())
    .option("--dry-run", `show ${operation} destinations without writing files`, false)
    .action(
      async (
        sourceOrName: string,
        commandOptions: {
          agents: string;
          home: string;
          dryRun: boolean;
          force?: boolean;
        },
      ) => {
        const homeDir = resolveHomePath(commandOptions.home);
        const externalSkillsPackage = getExternalSkillsPackageInstallSource(sourceOrName);
        if (operation === "install" && externalSkillsPackage && installExternalSkillDependency) {
          const result = await installExternalSkillsPackage({
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

        const result = await installSkill({
          rootDir,
          operation,
          source: sourceOrName,
          homeDir,
          agents: parseSkillInstallAgents(commandOptions.agents),
          dryRun: commandOptions.dryRun,
          force: operation === "install" ? commandOptions.force === true : false,
          refreshExisting: false,
        });

        printSkillInstallResult(result.skillInstall, operation);
      },
    );
}

interface InstallSkillInput {
  rootDir: string;
  operation: SkillChangeOperation;
  source: string;
  homeDir: string;
  agents: ReturnType<typeof parseSkillInstallAgents>;
  dryRun: boolean;
  force: boolean;
  refreshExisting: boolean;
}

interface InstallSkillResult {
  skillInstall: SkillInstallResult;
}

interface SkillInstallPrintOptions {
  showPostSkillChangeWelcome?: boolean;
}

interface InstallExternalSkillsPackageInput {
  rootDir: string;
  source: string;
  packageName: string;
  homeDir: string;
  dryRun: boolean;
  installExternalSkillDependency: OmniskillExternalSkillDependencyInstaller;
}

interface InstallExternalSkillsPackageResult {
  source: string;
  packageName: string;
  homeDir: string;
  dryRun: boolean;
}

async function installSkill(input: InstallSkillInput): Promise<InstallSkillResult> {
  const skillInstall = await installAgentSkill({
    source: input.source,
    cwd: input.rootDir,
    homeDir: input.homeDir,
    agents: input.agents,
    dryRun: input.dryRun,
    force: input.force,
    operation: input.operation,
    refreshExisting: input.refreshExisting,
  });

  return { skillInstall };
}

async function installExternalSkillsPackage(
  input: InstallExternalSkillsPackageInput,
): Promise<InstallExternalSkillsPackageResult> {
  if (input.dryRun) {
    return {
      source: input.source,
      packageName: input.packageName,
      homeDir: input.homeDir,
      dryRun: true,
    };
  }

  await input.installExternalSkillDependency({
    source: input.source,
    homeDir: input.homeDir,
  });

  return {
    source: input.source,
    packageName: input.packageName,
    homeDir: input.homeDir,
    dryRun: false,
  };
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
  operation: SkillChangeOperation = "install",
  options: SkillInstallPrintOptions = {},
): void {
  console.log(success(result.dryRun ? `Skill ${operation} plan` : `Skill ${operation} result`));
  console.log(keyValue("Skill", result.skillName));
  console.log(keyValue("Source", result.source.path));

  for (const target of result.targets) {
    console.log(
      `${target.agent}: ${formatSkillInstallStatus(target.status)} ${muted(target.destination)}`,
    );
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

function printExternalSkillsPackageInstallResult(result: InstallExternalSkillsPackageResult): void {
  console.log(
    success(result.dryRun ? "Skills package install plan" : "Skills package install result"),
  );
  console.log(keyValue("Package", result.packageName));
  console.log(keyValue("Home", result.homeDir));
  console.log(
    keyValue(
      "Internal command",
      `npx --yes skills@latest add ${result.packageName} --yes --global`,
    ),
  );

  if (!result.dryRun) {
    console.log("");
    console.log(success("Welcome to Omniskills."));
    console.log("Restart your agent IDE so it loads the latest skills.");
  }
}

function printPostSkillChangeWelcome(result: SkillInstallResult): void {
  if (result.dryRun) {
    return;
  }

  console.log("");
  console.log(success("Welcome to Omniskills."));
  console.log("Restart your agent IDE so it loads the latest skills.");
}

if (import.meta.main) {
  await buildProgram().parseAsync(process.argv);
}
