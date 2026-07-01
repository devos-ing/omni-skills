import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  MissingMattPocockSkillError,
  parseSkillInstallAgents,
  type SkillInstallResult,
} from "./plugins";
import {
  createWorkflowBundleScaffold,
  getWorkflowSkillInstallSources,
  installWorkflowBundle,
  listInstalledWorkflowBundles,
  loadWorkflowBundle,
} from "./runtimes/ponytrail";

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

export interface ConfigureGetSuperpowerCommandOptions {
  rootDir: string;
  installSkill: GetSuperpowerSkillInstaller;
  printSkillInstallResult: GetSuperpowerSkillInstallPrinter;
  installExternalSkillDependency?: GetSuperpowerExternalSkillDependencyInstaller;
}

type GetSuperpowerInstallVerb = "install" | "clone";

interface GetSuperpowerInstallCommandOptions {
  dir: string;
  agents: string;
  home: string;
}

export function configureGetSuperpowerCommand(
  program: Command,
  options: ConfigureGetSuperpowerCommandOptions,
): Command {
  configureGetSuperpowerCommands(program, options);

  const getsuperpowerCommand = program
    .command("getsuperpower")
    .description("Compatibility alias for root GetSuperpower commands.");
  configureGetSuperpowerCommands(getsuperpowerCommand, options);

  const bundleCommand = program
    .command("bundle")
    .description("Compatibility alias for GetSuperpower authoring.");
  configureAuthorCommands(bundleCommand, options.rootDir);

  const workflowCommand = program
    .command("workflow")
    .description("Compatibility alias for GetSuperpower install and list commands.");
  configureInstallCommand(workflowCommand, options, { includeClone: false });
  configureListCommand(workflowCommand, options.rootDir);

  return program;
}

function configureGetSuperpowerCommands(
  command: Command,
  options: ConfigureGetSuperpowerCommandOptions,
): void {
  configureAuthorCommands(command, options.rootDir);
  configureInstallCommand(command, options);
  configureListCommand(command, options.rootDir);
  configureDependencyCommand(command, options.rootDir);
}

function configureAuthorCommands(command: Command, rootDir: string): void {
  command
    .command("init")
    .description("Create a local GetSuperpower scaffold.")
    .argument("<name>", "GetSuperpower name")
    .option("--dir <dir>", "directory that will contain the GetSuperpower", rootDir)
    .action(async (name: string, commandOptions: { dir: string }) => {
      const scaffold = await createWorkflowBundleScaffold({
        rootDir: resolvePath(rootDir, commandOptions.dir),
        name,
      });

      console.log(`GetSuperpower created: ${scaffold.bundleDir}`);
      console.log(`${pc.dim("Manifest:")} ${scaffold.manifestPath}`);
      console.log(`${pc.dim("README:")} ${scaffold.readmePath}`);
    });

  command
    .command("validate")
    .description("Validate a GetSuperpower manifest.")
    .argument("<path>", "GetSuperpower directory or workflow.json path")
    .action(async (path: string) => {
      const bundle = await loadWorkflowBundle(path, { cwd: rootDir });

      console.log(`GetSuperpower valid: ${bundle.manifest.name}@${bundle.manifest.version}`);
      console.log(`${pc.dim("Steps:")} ${bundle.manifest.steps.length}`);
      console.log(`${pc.dim("Skills:")} ${bundle.manifest.skills.length}`);
    });
}

function configureInstallCommand(
  command: Command,
  options: ConfigureGetSuperpowerCommandOptions,
  commandOptions: { includeClone?: boolean } = {},
): void {
  configureInstallLikeCommand(command, options, "install");
  if (commandOptions.includeClone !== false) {
    configureInstallLikeCommand(command, options, "clone");
  }
}

function configureInstallLikeCommand(
  command: Command,
  options: ConfigureGetSuperpowerCommandOptions,
  verb: GetSuperpowerInstallVerb,
): void {
  command
    .command(verb)
    .description("Install a GetSuperpower and its skills.")
    .argument("<source>", "GetSuperpower name, local path, or workflow source")
    .option(
      "--dir <dir>",
      "project directory that receives .getsuperpower/workflows",
      options.rootDir,
    )
    .option(
      "--agents <agents>",
      "comma-separated skill install targets: codex,claude,cursor",
      "codex,claude,cursor",
    )
    .option("--home <dir>", "home directory that contains agent config folders", homedir())
    .action((source: string, commandOptions: GetSuperpowerInstallCommandOptions) =>
      runGetSuperpowerInstall(source, commandOptions, options),
    );
}

async function runGetSuperpowerInstall(
  source: string,
  commandOptions: GetSuperpowerInstallCommandOptions,
  options: ConfigureGetSuperpowerCommandOptions,
): Promise<void> {
  const targetDir = resolvePath(options.rootDir, commandOptions.dir);
  const bundle = await loadWorkflowBundle(source, { cwd: options.rootDir });
  const installAgents = parseSkillInstallAgents(commandOptions.agents);
  const homeDir = resolveHomePath(commandOptions.home);
  const installedExternalPackages = new Set<string>();

  for (const skillSource of getWorkflowSkillInstallSources(bundle)) {
    const skillResult = await installGetSuperpowerSkillDependency({
      rootDir: targetDir,
      source: skillSource,
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
  }

  const install = await installWorkflowBundle({ rootDir: targetDir, bundle });

  console.log(`GetSuperpower installed: ${install.workflow.name}`);
  console.log(`${pc.dim("GetSuperpower file:")} ${install.path}`);
}

async function installGetSuperpowerSkillDependency(input: {
  rootDir: string;
  source: string;
  homeDir: string;
  agents: ReturnType<typeof parseSkillInstallAgents>;
  installSkill: GetSuperpowerSkillInstaller;
  installExternalSkillDependency: GetSuperpowerExternalSkillDependencyInstaller;
  installedExternalPackages: Set<string>;
}): Promise<GetSuperpowerInstallSkillResult> {
  try {
    return await installWorkflowSkillDependency(input);
  } catch (error) {
    const externalPackage = getSkillsCliPackageForMissingDependency(input.source, error);
    if (!externalPackage) {
      throw error;
    }

    if (!input.installedExternalPackages.has(externalPackage)) {
      console.log(`Installing external skill dependency with skills CLI: ${externalPackage}`);
      await input.installExternalSkillDependency({
        source: input.source,
        homeDir: input.homeDir,
      });
      input.installedExternalPackages.add(externalPackage);
    }

    try {
      return await installWorkflowSkillDependency(input);
    } catch (retryError) {
      if (retryError instanceof MissingMattPocockSkillError) {
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

function getSkillsCliPackageForMissingDependency(source: string, error: unknown): string | null {
  if (!(error instanceof MissingMattPocockSkillError)) {
    return null;
  }

  return getSkillsCliPackageForSource(source);
}

export function getSkillsCliPackageForSource(source: string): string | null {
  if (isBareSkillsCliPackage(source)) {
    return source;
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

function isBareSkillsCliPackage(source: string): boolean {
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(source);
}

export async function installExternalSkillDependencyWithSkillsCli(
  input: GetSuperpowerExternalSkillDependencyInstallInput,
): Promise<void> {
  const packageName = getSkillsCliPackageForSource(input.source);
  if (!packageName) {
    throw new Error(`No skills CLI package is known for dependency: ${input.source}`);
  }

  const result = await (input.runCommand ?? runExternalSkillCommand)({
    executable: "npx",
    args: ["--yes", "skills@latest", "add", packageName],
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
  const subprocess = Bun.spawn([command.executable, ...command.args], {
    cwd: command.cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: command.env,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return { stdout, stderr, exitCode };
}

function configureListCommand(command: Command, rootDir: string): void {
  command
    .command("list")
    .description("List installed GetSuperpowers.")
    .option("--dir <dir>", "project directory with .getsuperpower/workflows", rootDir)
    .action(async (commandOptions: { dir: string }) => {
      const workflows = await listInstalledWorkflowBundles({
        rootDir: resolvePath(rootDir, commandOptions.dir),
      });

      if (workflows.length === 0) {
        console.log(pc.dim("No GetSuperpowers installed."));
        return;
      }

      for (const workflow of workflows) {
        console.log(`${workflow.name} ${workflow.version}`);
      }
    });
}

function configureDependencyCommand(command: Command, rootDir: string): void {
  command
    .command("deps")
    .aliases(["dependencies", "dependence"])
    .description("List the skill dependencies declared by a GetSuperpower.")
    .argument("<source>", "bundled GetSuperpower name or local GetSuperpower path")
    .action(async (source: string) => {
      const bundle = await loadWorkflowBundle(source, { cwd: rootDir });

      console.log(`GetSuperpower dependencies: ${bundle.manifest.name}`);
      for (const skill of bundle.manifest.skills) {
        const optional = skill.optional ? " (optional)" : "";
        console.log(`- ${skill.source}${optional}`);
      }
    });
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
