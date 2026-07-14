import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { cancel as clackCancel, confirm as clackConfirm, isCancel } from "@clack/prompts";
import type { Command } from "commander";
import {
  commandText,
  getOmniskillInstallResultBox,
  keyValue,
  muted,
  nextStep,
  success,
  warning,
} from "./cli-theme";
import {
  type AgentProfileArtifact,
  createOrchestrationRunStore,
  executeAgentProfilePlan,
  getInterfaceCraftInstalledSkillName,
  loadOrchestrationConfigPlan,
  MissingInterfaceCraftSkillError,
  MissingMattPocockSkillError,
  MissingSuperpowersSkillError,
  type OrchestrationDispatcher,
  type OrchestrationRunStore,
  parseSkillInstallAgents,
  preflightAgentProfiles,
  resolveInstallSkillName,
  type SkillInstallResult,
  SkillSourceNotFoundError,
} from "./plugins";
import { runSubprocess } from "./process";
import {
  type AgentProfileTarget,
  createWorkflowBundleScaffold,
  createWorkflowRemovalPlan,
  type DispatchAttempt,
  type DispatchReceipt,
  type DispatchRequest,
  DispatchRuntimeSchema,
  executeWorkflowRemovalPlan,
  getPreparedWorkflowSkillInstallDependencies,
  getWorkflowInvocationSkillName,
  installWorkflowBundle,
  listInstalledWorkflowBundles,
  loadInstalledWorkflowBundle,
  loadWorkflowBundle,
  planAgentProfiles,
  planOrchestrationDispatch,
  resolveWorkflowDependencyGraph,
  type WorkflowGitCommandRunner,
  type WorkflowInstallArtifact,
  type WorkflowRemovalPlan,
  writeWorkflowLockFile,
} from "./runtimes/omniskill";

export interface OmniskillInstallSkillInput {
  rootDir: string;
  operation: "install";
  source: string;
  homeDir: string;
  agents: ReturnType<typeof parseSkillInstallAgents>;
  dryRun: false;
  force: boolean;
  refreshExisting: boolean;
}

export interface OmniskillInstallSkillResult {
  skillInstall: SkillInstallResult;
}

export type OmniskillSkillInstaller = (
  input: OmniskillInstallSkillInput,
) => Promise<OmniskillInstallSkillResult>;

export interface OmniskillSkillInstallPrintOptions {
  showPostSkillChangeWelcome?: boolean;
}

export type OmniskillSkillInstallPrinter = (
  result: SkillInstallResult,
  operation: "install",
  options: OmniskillSkillInstallPrintOptions,
) => void;

export interface OmniskillExternalSkillDependencyInstallInput {
  source: string;
  repo?: string;
  homeDir: string;
  runCommand?: OmniskillExternalSkillCommandRunner;
}

export type OmniskillExternalSkillDependencyInstaller = (
  input: OmniskillExternalSkillDependencyInstallInput,
) => Promise<void>;

export interface OmniskillExternalSkillCommand {
  executable: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
}

export interface OmniskillExternalSkillCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type OmniskillExternalSkillCommandRunner = (
  command: OmniskillExternalSkillCommand,
) => Promise<OmniskillExternalSkillCommandResult>;

export interface OmniskillOnboardPrompt {
  confirm(input: { message: string; defaultValue: boolean }): Promise<boolean>;
}

export interface OmniskillInstallSkillPlan {
  source: string;
  repo?: string | undefined;
}

export interface OmniskillInstallPromptInput {
  workflowName: string;
  workflowVersion: string;
  skills: OmniskillInstallSkillPlan[];
  targetDir: string;
  homeDir: string;
  agents: ReturnType<typeof parseSkillInstallAgents>;
}

export interface OmniskillInstallPrompt {
  confirmInstall(input: OmniskillInstallPromptInput): Promise<boolean>;
}

export interface OmniskillRemovePromptInput {
  workflowName: string;
  artifactsToRemove: number;
  artifactsToKeep: number;
}

export interface OmniskillRemovePrompt {
  confirmRemove(input: OmniskillRemovePromptInput): Promise<boolean>;
}

export interface OmniskillOnboardCommand {
  executable: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
}

export interface OmniskillOnboardCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type OmniskillOnboardCommandRunner = (
  command: OmniskillOnboardCommand,
) => Promise<OmniskillOnboardCommandResult>;

export interface ConfigureOmniskillCommandOptions {
  rootDir: string;
  installSkill: OmniskillSkillInstaller;
  printSkillInstallResult: OmniskillSkillInstallPrinter;
  installExternalSkillDependency?: OmniskillExternalSkillDependencyInstaller;
  installPrompt?: OmniskillInstallPrompt;
  removePrompt?: OmniskillRemovePrompt;
  workflowGitCommandRunner?: WorkflowGitCommandRunner;
  onboardPrompt?: OmniskillOnboardPrompt;
  onboardCommandRunner?: OmniskillOnboardCommandRunner;
  dispatchers?: Partial<Record<"codex" | "claude", OrchestrationDispatcher>>;
  createRunStore?: (homeDir: string) => OrchestrationRunStore;
}

interface OmniskillInstallCommandOptions {
  dir?: string;
  agents: string;
  home: string;
  dryRun: boolean;
  force: boolean;
}

interface OmniskillRemoveCommandOptions {
  dir?: string;
  home: string;
  dryRun: boolean;
  yes: boolean;
}

interface OmniskillDispatchCommandOptions {
  role: string;
  task?: string;
  taskFile?: string;
  runtime: string;
  home: string;
  dir?: string;
  approveWorkspaceWrite: boolean;
  dryRun: boolean;
  json: boolean;
}

type OmniskillLoopCommandName = "start" | "status" | "log" | "advance" | "summary";

interface OmniskillLoopCommandOptions {
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

export function configureOmniskillCommand(
  program: Command,
  options: ConfigureOmniskillCommandOptions,
): Command {
  configureOmniskillCommands(program, options);

  const bundleCommand = program
    .command("bundle")
    .description("Compatibility alias for Omniskills authoring.");
  configureAuthorCommands(bundleCommand, options);
  configureLockCommand(bundleCommand, options);

  const workflowCommand = program
    .command("workflow")
    .description("Compatibility alias for Omniskills install, list, and remove commands.");
  configureInstallCommand(workflowCommand, options);
  configureListCommand(workflowCommand, options.rootDir);
  configureRemoveCommand(workflowCommand, options);

  return program;
}

function configureOmniskillCommands(
  command: Command,
  options: ConfigureOmniskillCommandOptions,
): void {
  configureAuthorCommands(command, options);
  configureLockCommand(command, options);
  configureInstallCommand(command, options);
  configureListCommand(command, options.rootDir);
  configureRemoveCommand(command, options);
  configureDependencyCommand(command, options);
  configureOnboardCommand(command, options);
  configureDispatchCommand(command, options);
  configureLoopCommand(command, options);
}

function configureDispatchCommand(
  command: Command,
  options: ConfigureOmniskillCommandOptions,
): void {
  command
    .command("dispatch")
    .description("Dispatch an installed Omniskills role through a verified runtime profile.")
    .argument("<workflow-name>", "installed workflow or team name")
    .requiredOption("--role <source>", "role source or support id")
    .option("--task <text>", "task text")
    .option("--task-file <path>", "read task text from a file")
    .option("--runtime <runtime>", "codex or claude", "codex")
    .option("--home <dir>", "home directory with Omniskills state", homedir())
    .option("--dir <dir>", "override directory with installed workflow records")
    .option("--approve-workspace-write", "approve the implementation write gate", false)
    .option("--dry-run", "print the launch plan without starting a child", false)
    .option("--json", "print machine-readable output", false)
    .action(async (workflowName: string, commandOptions: OmniskillDispatchCommandOptions) => {
      const hasTask = commandOptions.task !== undefined;
      const hasTaskFile = commandOptions.taskFile !== undefined;
      if (hasTask === hasTaskFile) {
        throw new Error("Dispatch requires exactly one of --task or --task-file");
      }
      const homeDir = resolveHomePath(commandOptions.home);
      const targetDir = commandOptions.dir
        ? resolvePath(options.rootDir, commandOptions.dir)
        : homeDir;
      const runtime = DispatchRuntimeSchema.parse(commandOptions.runtime);
      const dispatcher = options.dispatchers?.[runtime];
      const available = dispatcher ? await dispatcher.available(options.rootDir) : false;
      const task = commandOptions.taskFile
        ? await readFile(resolvePath(options.rootDir, commandOptions.taskFile), "utf8")
        : (commandOptions.task as string);
      const installed = await loadInstalledWorkflowBundle({
        rootDir: targetDir,
        workflowName,
      });
      const planSet = await planOrchestrationDispatch({
        workflow: installed.workflow,
        role: commandOptions.role,
        runtime,
        task,
        cwd: options.rootDir,
        homeDir,
        approveWorkspaceWrite: commandOptions.approveWorkspaceWrite,
        capabilities: { [runtime]: available },
        readProfile: (path) => readFile(path, "utf8"),
      });
      if (commandOptions.dryRun) {
        if (commandOptions.json) {
          console.log(JSON.stringify(planSet, null, 2));
          return;
        }
        console.log(success(`Orchestration dispatch plan: ${planSet.primary.profileId}`));
        console.log(keyValue("Runtime", planSet.primary.runtime));
        console.log(keyValue("Tier", planSet.primary.tier));
        console.log(keyValue("Model", planSet.primary.model));
        console.log(keyValue("Effort", planSet.primary.effort));
        console.log(keyValue("Access", planSet.primary.access));
        console.log(keyValue("Evidence required", planSet.primary.evidenceRequired));
        return;
      }
      const request: DispatchRequest = {
        workflow: workflowName,
        role: commandOptions.role,
        task,
        cwd: options.rootDir,
        homeDir,
        runtime,
        approveWorkspaceWrite: commandOptions.approveWorkspaceWrite,
      };
      const store = (
        options.createRunStore ?? ((dir) => createOrchestrationRunStore({ homeDir: dir }))
      )(homeDir);
      const plannedReceipt = await store.create({ request, planSet });
      if (!dispatcher) {
        throw new Error(`Dispatch runtime unavailable: ${runtime}`);
      }
      const result = await dispatcher.dispatch(planSet.primary);
      const attempt: DispatchAttempt = {
        attemptNumber: 1,
        candidateIndex: planSet.primary.candidateIndex,
        profileId: planSet.primary.profileId,
        model: planSet.primary.model,
        status: result.status,
        evidence: result.evidence,
        ...(result.sessionId ? { sessionId: result.sessionId } : {}),
        ...(result.failureCode ? { failureCode: result.failureCode } : {}),
        ...(result.failureReason ? { failureReason: result.failureReason } : {}),
      };
      const receipt: DispatchReceipt = {
        ...plannedReceipt,
        status: result.status,
        evidence: result.evidence,
        consultationCount:
          plannedReceipt.consultationCount + (result.status === "consultation_required" ? 1 : 0),
        ...(result.sessionId ? { sessionId: result.sessionId } : {}),
        ...(result.failureCode ? { failureCode: result.failureCode } : {}),
        ...(result.failureReason ? { failureReason: result.failureReason } : {}),
        updatedAt: new Date().toISOString(),
      };
      await store.appendAttempt(plannedReceipt.runId, attempt);
      await store.finish(plannedReceipt.runId, receipt);
      if (commandOptions.json) {
        console.log(JSON.stringify(receipt, null, 2));
      } else {
        console.log(success(`Orchestration dispatch ${receipt.status}: ${receipt.runId}`));
        console.log(keyValue("Profile", receipt.profileId));
        console.log(keyValue("Model", receipt.model));
        console.log(keyValue("Evidence", receipt.evidence));
      }
      if (result.status === "failed") {
        throw new Error(result.failureReason ?? `Orchestration dispatch failed: ${receipt.runId}`);
      }
    });
}

function configureAuthorCommands(
  command: Command,
  options: ConfigureOmniskillCommandOptions,
): void {
  command
    .command("init")
    .description("Create a local Omniskills scaffold.")
    .argument("<name>", "Omniskills name")
    .option("--dir <dir>", "directory that will contain the Omniskills workflow", options.rootDir)
    .action(async (name: string, commandOptions: { dir: string }) => {
      const scaffold = await createWorkflowBundleScaffold({
        rootDir: resolvePath(options.rootDir, commandOptions.dir),
        name,
      });

      console.log(success(`Omniskills created: ${scaffold.bundleDir}`));
      console.log(keyValue("Manifest", scaffold.manifestPath));
      console.log(keyValue("README", scaffold.readmePath));
    });

  command
    .command("validate")
    .description("Validate an Omniskills manifest.")
    .argument("<path>", "Omniskills directory or workflow.json path")
    .action(async (path: string) => {
      const bundle = await loadWorkflowBundle(path, {
        cwd: options.rootDir,
        ...(options.workflowGitCommandRunner
          ? { runGitCommand: options.workflowGitCommandRunner }
          : {}),
      });
      let graph: Awaited<ReturnType<typeof resolveWorkflowDependencyGraph>> | undefined;
      try {
        graph = await resolveWorkflowDependencyGraph({
          bundle,
          ...(options.workflowGitCommandRunner
            ? { runGitCommand: options.workflowGitCommandRunner }
            : {}),
          installedRootDir: options.rootDir,
        });
        console.log(
          success(`Omniskills valid: ${bundle.manifest.name}@${bundle.manifest.version}`),
        );
        console.log(keyValue("Steps", String(bundle.manifest.steps.length)));
        console.log(keyValue("Skills", String(graph.dependencies.length)));
      } finally {
        await graph?.cleanup?.();
        await bundle.cleanup?.();
      }
    });
}

function configureLockCommand(command: Command, options: ConfigureOmniskillCommandOptions): void {
  command
    .command("lock")
    .description("Generate workflow.lock.json skill fingerprints for a local Omniskills workflow.")
    .argument("<source>", "local Omniskills directory or workflow.json path")
    .action(async (source: string) => {
      const bundle = await loadWorkflowBundle(source, {
        cwd: options.rootDir,
        ...(options.workflowGitCommandRunner
          ? { runGitCommand: options.workflowGitCommandRunner }
          : {}),
      });

      try {
        if (bundle.source.kind !== "local") {
          throw new Error(
            "Omniskills lock can only write local workflow sources. Clone or open the workflow source directory, then run lock there.",
          );
        }

        const result = await writeWorkflowLockFile(bundle, {
          ...(options.workflowGitCommandRunner
            ? { runGitCommand: options.workflowGitCommandRunner }
            : {}),
          installedRootDir: options.rootDir,
        });
        console.log(success(`Omniskills lock written: ${bundle.manifest.name}`));
        console.log(keyValue("Lock file", result.path));
        console.log(keyValue("Skills", String(result.lock.skills.length)));
      } finally {
        await bundle.cleanup?.();
      }
    });
}

function configureInstallCommand(
  command: Command,
  options: ConfigureOmniskillCommandOptions,
): void {
  command
    .command("install")
    .description("Install an Omniskills workflow or team and its skills.")
    .argument(
      "<source>",
      "workflow or team alias, local Omniskills path, workflow.json path, or public git source",
    )
    .option("--dir <dir>", "override directory that receives .omniskills/workflows")
    .option(
      "--agents <agents>",
      "comma-separated skill install targets: codex,claude,cursor,copilot,opencode (aliases: github-copilot,opencodex)",
      "codex,claude,cursor",
    )
    .option(
      "--home <dir>",
      "home directory for global Omniskills records and agent config folders",
      homedir(),
    )
    .option("--dry-run", "print the complete install plan without writing files", false)
    .option("--force", "replace drifted managed agent profiles", false)
    .action((source: string, commandOptions: OmniskillInstallCommandOptions) =>
      runOmniskillInstall(source, commandOptions, options),
    );
}

async function runOmniskillInstall(
  source: string,
  commandOptions: OmniskillInstallCommandOptions,
  options: ConfigureOmniskillCommandOptions,
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
  const installPrompt = options.installPrompt ?? createDefaultInstallPrompt();
  let preparedDependencies:
    | Awaited<ReturnType<typeof getPreparedWorkflowSkillInstallDependencies>>
    | undefined;

  try {
    preparedDependencies = await getPreparedWorkflowSkillInstallDependencies({
      bundle,
      ...(options.workflowGitCommandRunner
        ? { runGitCommand: options.workflowGitCommandRunner }
        : {}),
      installedRootDir: targetDir,
    });
    const skillPlans = preparedDependencies.dependencies.map((dependency, index) => ({
      source: preparedDependencies?.displaySources[index] ?? dependency.source,
      ...(dependency.repo ? { repo: dependency.repo } : {}),
    }));
    const configPlan = bundle.manifest.orchestration
      ? await loadOrchestrationConfigPlan({ homeDir })
      : undefined;
    const roleSkillNames = Object.fromEntries(
      await Promise.all(
        Object.entries(preparedDependencies.roleSkills).map(async ([source, roleSkill]) => [
          source,
          await resolveInstallSkillName(roleSkill.source, {
            homeDir,
            ...(roleSkill.installedName ? { expectedName: roleSkill.installedName } : {}),
          }),
        ]),
      ),
    );
    const plannedProfiles = configPlan
      ? planAgentProfiles({
          manifest: bundle.manifest,
          config: configPlan.config,
          homeDir,
          targets: orchestrationTargets(installAgents),
          roleSkillNames,
        })
      : [];
    const installedWorkflow = (await listInstalledWorkflowBundles({ rootDir: targetDir })).find(
      (workflow) => workflow.name === bundle.manifest.name,
    );
    const previousProfiles = (installedWorkflow?.installArtifacts ?? []).filter(
      (artifact): artifact is AgentProfileArtifact => artifact.kind === "agent_profile",
    );
    const profilePlan = await preflightAgentProfiles({
      profiles: plannedProfiles,
      previousArtifacts: previousProfiles,
      force: commandOptions.force,
    });
    printOmniskillInstallPlan({
      workflowName: bundle.manifest.name,
      workflowVersion: bundle.manifest.version,
      skills: skillPlans,
      targetDir,
      homeDir,
      ...(configPlan ? { configPlan } : {}),
      profilePlan,
    });

    if (profilePlan.some(({ status }) => status === "conflict")) {
      throw new Error("Omniskills install blocked by agent profile conflicts");
    }
    if (commandOptions.dryRun) return;

    const approved = await installPrompt.confirmInstall({
      workflowName: bundle.manifest.name,
      workflowVersion: bundle.manifest.version,
      skills: skillPlans,
      targetDir,
      homeDir,
      agents: installAgents,
    });

    if (!approved) {
      console.log(warning("Omniskills install cancelled."));
      return;
    }

    console.log(success("Installing skills..."));

    const versionRefreshSources = await getWorkflowVersionRefreshSources({
      rootDir: targetDir,
      workflowName: bundle.manifest.name,
      workflowVersion: bundle.manifest.version,
    });
    const skillDependencies = preparedDependencies.dependencies;
    const installArtifacts: WorkflowInstallArtifact[] = [];
    for (const [index, skillDependency] of skillDependencies.entries()) {
      const manifestSource = preparedDependencies.displaySources[index] ?? skillDependency.source;
      const displaySkill = manifestSource;
      console.log(`Processing ${index + 1}/${skillDependencies.length}: ${displaySkill}`);
      const skillResult = await installOmniskillSkillDependency({
        rootDir: targetDir,
        source: skillDependency.source,
        ...(skillDependency.repo ? { repo: skillDependency.repo } : {}),
        ...(skillDependency.installedName
          ? { expectedInstalledName: skillDependency.installedName }
          : {}),
        homeDir,
        agents: installAgents,
        installSkill: options.installSkill,
        installExternalSkillDependency:
          options.installExternalSkillDependency ?? installExternalSkillDependencyWithSkillsCli,
        installedExternalPackages,
        forceRefreshExisting: versionRefreshSources.has(manifestSource),
      });

      if (
        skillDependency.installedName &&
        skillResult.skillInstall.skillName !== skillDependency.installedName
      ) {
        throw new Error(
          `Installed skill name mismatch for ${manifestSource}: expected ${skillDependency.installedName}, resolved ${skillResult.skillInstall.skillName}`,
        );
      }

      for (const target of skillResult.skillInstall.targets) {
        installArtifacts.push({
          source: manifestSource,
          skillName: skillResult.skillInstall.skillName,
          agent: target.agent,
          status: target.status,
          paths: target.artifactPaths,
        });
      }

      options.printSkillInstallResult(skillResult.skillInstall, "install", {
        showPostSkillChangeWelcome: false,
      });
      console.log(success(`Installed skill: ${skillResult.skillInstall.skillName}`));
    }

    if (configPlan) {
      const profileArtifacts = await executeAgentProfilePlan({
        profiles: profilePlan,
        config: configPlan,
      });
      installArtifacts.push(...profileArtifacts);
    }

    const install = await installWorkflowBundle({ rootDir: targetDir, bundle, installArtifacts });

    console.log(success(`Omniskills installed: ${install.workflow.name}`));
    console.log(keyValue("Omniskills file", install.path));
    console.log(
      getOmniskillInstallResultBox({
        workflowName: install.workflow.name,
        workflowVersion: install.workflow.version,
        workflowFile: install.path,
        skillCount: skillDependencies.length,
      }),
    );
    const invocationSkillName = getWorkflowInvocationSkillName(bundle.manifest);
    if (invocationSkillName) {
      console.log(nextStep(`$${invocationSkillName}`));
    }
  } finally {
    await preparedDependencies?.cleanup?.();
    await bundle.cleanup?.();
  }
}

async function getWorkflowVersionRefreshSources(input: {
  rootDir: string;
  workflowName: string;
  workflowVersion: string;
}): Promise<Set<string>> {
  const installedWorkflow = (await listInstalledWorkflowBundles({ rootDir: input.rootDir })).find(
    (workflow) => workflow.name === input.workflowName,
  );
  if (!installedWorkflow || installedWorkflow.version === input.workflowVersion) {
    return new Set();
  }

  return new Set((installedWorkflow.installArtifacts ?? []).map((artifact) => artifact.source));
}

function printOmniskillInstallPlan(input: {
  workflowName: string;
  workflowVersion: string;
  skills: OmniskillInstallSkillPlan[];
  targetDir: string;
  homeDir: string;
  configPlan?: Awaited<ReturnType<typeof loadOrchestrationConfigPlan>>;
  profilePlan: Awaited<ReturnType<typeof preflightAgentProfiles>>;
}): void {
  console.log(success(`Omniskills install plan: ${input.workflowName}@${input.workflowVersion}`));
  console.log(keyValue("Workflow records", input.targetDir));
  console.log(keyValue("Skill home", input.homeDir));
  console.log("Skills to install:");
  for (const skill of input.skills) {
    console.log(`- ${formatInstallSkillPlan(skill)}`);
  }
  console.log("Agent profiles:");
  if (input.profilePlan.length === 0) console.log("- none");
  for (const planned of input.profilePlan) {
    const profile = "profile" in planned ? planned.profile : undefined;
    const artifact = planned.artifact;
    const candidateIndex = profile?.candidateIndex ?? artifact.candidateIndex;
    const candidateCount = profile?.candidateCount ?? artifact.candidateCount;
    console.log(
      [
        `- ${planned.status}: ${profile?.profileId ?? artifact.profileId}`,
        `target=${profile?.target ?? artifact.agent}`,
        `source=${profile?.source ?? artifact.source}`,
        `taskClass=${profile?.taskClass ?? artifact.taskClass ?? "unknown"}`,
        `tier=${profile?.tier ?? artifact.tier ?? "unknown"}`,
        `model=${profile?.model ?? artifact.model ?? "unknown"}`,
        `effort=${profile?.effort ?? artifact.effort ?? "unknown"}`,
        `candidate=${candidateIndex === undefined ? "unknown" : candidateIndex + 1}/${candidateCount ?? "unknown"}`,
        `ownership=${planned.ownership}`,
        `path=${profile?.destination ?? artifact.path}`,
      ].join(" "),
    );
  }
  if (input.configPlan) {
    console.log(
      keyValue("Orchestration config", `${input.configPlan.status}: ${input.configPlan.path}`),
    );
  }
}

function orchestrationTargets(
  agents: ReturnType<typeof parseSkillInstallAgents>,
): AgentProfileTarget[] {
  return agents.filter(
    (agent): agent is AgentProfileTarget => agent === "codex" || agent === "claude",
  );
}

function formatInstallSkillPlan(skill: OmniskillInstallSkillPlan): string {
  return skill.repo ? `${skill.source} (${skill.repo})` : skill.source;
}

async function installOmniskillSkillDependency(input: {
  rootDir: string;
  source: string;
  repo?: string;
  expectedInstalledName?: string;
  homeDir: string;
  agents: ReturnType<typeof parseSkillInstallAgents>;
  installSkill: OmniskillSkillInstaller;
  installExternalSkillDependency: OmniskillExternalSkillDependencyInstaller;
  installedExternalPackages: Set<string>;
  forceRefreshExisting: boolean;
}): Promise<OmniskillInstallSkillResult> {
  try {
    return await installWorkflowSkillDependency(input);
  } catch (error) {
    const externalPackage = getSkillsCliPackageForMissingDependency(
      input.source,
      input.repo,
      input.expectedInstalledName,
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
      if (
        isMissingBootstrappableSkillError(retryError, {
          ...(input.repo ? { repo: input.repo } : {}),
          ...(input.expectedInstalledName
            ? { expectedInstalledName: input.expectedInstalledName }
            : {}),
        })
      ) {
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
  installSkill: OmniskillSkillInstaller;
  forceRefreshExisting: boolean;
}): Promise<OmniskillInstallSkillResult> {
  return input.installSkill({
    rootDir: input.rootDir,
    operation: "install",
    source: input.source,
    homeDir: input.homeDir,
    agents: input.agents,
    dryRun: false,
    force: input.forceRefreshExisting,
    refreshExisting: !input.forceRefreshExisting,
  });
}

function getSkillsCliPackageForMissingDependency(
  source: string,
  repo: string | undefined,
  expectedInstalledName: string | undefined,
  error: unknown,
): string | null {
  if (
    !isMissingBootstrappableSkillError(error, {
      ...(repo ? { repo } : {}),
      ...(expectedInstalledName ? { expectedInstalledName } : {}),
    })
  ) {
    return null;
  }

  return getSkillsCliPackageForDependency(source, repo);
}

function isMissingBootstrappableSkillError(
  error: unknown,
  options: { repo?: string; expectedInstalledName?: string } = {},
): error is
  | MissingInterfaceCraftSkillError
  | MissingMattPocockSkillError
  | MissingSuperpowersSkillError
  | SkillSourceNotFoundError {
  return (
    error instanceof MissingInterfaceCraftSkillError ||
    error instanceof MissingMattPocockSkillError ||
    error instanceof MissingSuperpowersSkillError ||
    (error instanceof SkillSourceNotFoundError &&
      Boolean(options.repo) &&
      Boolean(options.expectedInstalledName))
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

  if (getInterfaceCraftInstalledSkillName(source)) {
    return "emilkowalski/skills";
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
  const interfaceCraftSkillName = getInterfaceCraftInstalledSkillName(source);
  if (interfaceCraftSkillName) {
    return interfaceCraftSkillName;
  }

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
  input: OmniskillExternalSkillDependencyInstallInput,
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
  command: OmniskillExternalSkillCommand,
): Promise<OmniskillExternalSkillCommandResult> {
  return runSubprocess(command);
}

function configureListCommand(command: Command, rootDir: string): void {
  command
    .command("list")
    .description("List installed Omniskills workflows and teams.")
    .option("--dir <dir>", "override directory with .omniskills/workflows")
    .option("--home <dir>", "home directory that contains global Omniskills records", homedir())
    .action(async (commandOptions: { dir?: string; home: string }) => {
      const targetDir = commandOptions.dir
        ? resolvePath(rootDir, commandOptions.dir)
        : resolveHomePath(commandOptions.home);
      const workflows = await listInstalledWorkflowBundles({
        rootDir: targetDir,
      });

      if (workflows.length === 0) {
        console.log(muted("No Omniskills workflows installed."));
        console.log(nextStep("omniskill install <path-or-git-url>"));
        return;
      }

      for (const workflow of workflows) {
        console.log(`${workflow.name} ${workflow.version}`);
      }
    });
}

function configureRemoveCommand(command: Command, options: ConfigureOmniskillCommandOptions): void {
  command
    .command("remove")
    .description(
      "Remove an installed Omniskills workflow or team and its recorded skill artifacts.",
    )
    .argument("<workflow-name>", "installed Omniskills workflow or team name")
    .option("--dir <dir>", "override directory with .omniskills/workflows")
    .option("--home <dir>", "home directory with global Omniskills records", homedir())
    .option("--dry-run", "print the removal plan without deleting files", false)
    .option("--yes", "remove without prompting for confirmation", false)
    .action((workflowName: string, commandOptions: OmniskillRemoveCommandOptions) =>
      runOmniskillRemove(workflowName, commandOptions, options),
    );
}

async function runOmniskillRemove(
  workflowName: string,
  commandOptions: OmniskillRemoveCommandOptions,
  options: ConfigureOmniskillCommandOptions,
): Promise<void> {
  const homeDir = resolveHomePath(commandOptions.home);
  const targetDir = commandOptions.dir ? resolvePath(options.rootDir, commandOptions.dir) : homeDir;
  const plan = await createWorkflowRemovalPlan({
    rootDir: targetDir,
    homeDir,
    workflowName,
  });
  printOmniskillRemovePlan(plan, commandOptions.dryRun);

  if (commandOptions.dryRun) {
    return;
  }

  const prompt = options.removePrompt ?? createDefaultRemovePrompt();
  const approved =
    commandOptions.yes ||
    (await prompt.confirmRemove({
      workflowName,
      artifactsToRemove: plan.artifactsToRemove.length,
      artifactsToKeep: plan.artifactsToKeep.length,
    }));
  if (!approved) {
    console.log(warning("Omniskills remove cancelled."));
    return;
  }

  await executeWorkflowRemovalPlan(plan);
  console.log(success(`Omniskills removed: ${workflowName}`));
}

function printOmniskillRemovePlan(plan: WorkflowRemovalPlan, dryRun: boolean): void {
  console.log(success(`Omniskills remove plan: ${plan.workflow.name}`));
  console.log(keyValue("Workflow record", plan.workflowRecordPath));
  if (plan.legacy) {
    console.log(warning("Legacy workflow record detected; removal paths are inferred."));
  }

  const removeHeading = dryRun ? "Artifacts that would be removed:" : "Artifacts to remove:";
  console.log(removeHeading);
  if (plan.artifactsToRemove.length === 0) {
    console.log("- none");
  } else {
    for (const artifact of plan.artifactsToRemove) {
      console.log(`- ${artifact.path}`);
    }
  }

  if (plan.artifactsToKeep.length > 0) {
    console.log("Artifacts kept:");
    for (const artifact of plan.artifactsToKeep) {
      console.log(`- ${artifact.path} (still used by ${artifact.usedByWorkflows.join(", ")})`);
    }
  }

  if (plan.skippedArtifacts.length > 0) {
    console.log("Skipped artifacts:");
    for (const artifact of plan.skippedArtifacts) {
      console.log(`- ${artifact.source}: ${artifact.reason}`);
    }
  }
}

function configureDependencyCommand(
  command: Command,
  options: ConfigureOmniskillCommandOptions,
): void {
  command
    .command("deps")
    .aliases(["dependencies", "dependence"])
    .description("List the skill dependencies declared by an Omniskills workflow or team.")
    .argument("<source>", "local Omniskills path, workflow.json path, or public git source")
    .action(async (source: string) => {
      const bundle = await loadWorkflowBundle(source, {
        cwd: options.rootDir,
        ...(options.workflowGitCommandRunner
          ? { runGitCommand: options.workflowGitCommandRunner }
          : {}),
      });
      const graph = await resolveWorkflowDependencyGraph({
        bundle,
        ...(options.workflowGitCommandRunner
          ? { runGitCommand: options.workflowGitCommandRunner }
          : {}),
        installedRootDir: options.rootDir,
      });
      try {
        console.log(success(`Omniskills dependencies: ${bundle.manifest.name}`));
        for (const [index, skill] of graph.dependencies.entries()) {
          console.log(`- ${graph.displaySources[index] ?? skill.source}`);
        }
      } finally {
        await graph.cleanup?.();
        await bundle.cleanup?.();
      }
    });
}

function configureLoopCommand(command: Command, options: ConfigureOmniskillCommandOptions): void {
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
  name: OmniskillLoopCommandName,
  description: string,
  options: ConfigureOmniskillCommandOptions,
): Command {
  return command
    .command(name)
    .description(description)
    .argument(
      "<source>",
      "workflow alias, local Omniskills path, workflow.json path, or public git source",
    )
    .option("--home <dir>", "home directory for global Omniskills loop run state", homedir())
    .action((source: string, commandOptions: OmniskillLoopCommandOptions) =>
      runOmniskillLoop(name, source, commandOptions, options),
    );
}

async function runOmniskillLoop(
  command: OmniskillLoopCommandName,
  source: string,
  commandOptions: OmniskillLoopCommandOptions,
  options: ConfigureOmniskillCommandOptions,
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
      throw new Error(`Omniskills is not loop-enabled: ${bundle.manifest.name}`);
    }

    const { runWorkflowLoopCli } = (await importWorkflowLoopRuntime()) as WorkflowLoopRuntimeModule;
    const exitCode = await runWorkflowLoopCli({
      argv: buildLoopRuntimeArgs(command, commandOptions),
      workflowJson: bundle.manifestPath,
      cwd: options.rootDir,
      homeDir,
      commandPrefix: createLoopCommandPrefix(source, homeDir),
    });

    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  } finally {
    await bundle.cleanup?.();
  }
}

async function importWorkflowLoopRuntime(): Promise<unknown> {
  const runtimeModulePath = "./runtimes/omniskill/workflow-loop-runtime.mjs";
  return import(runtimeModulePath);
}

function createLoopCommandPrefix(source: string, homeDir: string): (command: string) => string {
  const defaultHomeDir = resolveHomePath(homedir());
  const homeOption = homeDir === defaultHomeDir ? "" : ` --home ${quoteShellArg(homeDir)}`;
  return (command) => `omniskill loop ${command} ${quoteShellArg(source)}${homeOption}`;
}

function buildLoopRuntimeArgs(
  command: OmniskillLoopCommandName,
  options: OmniskillLoopCommandOptions,
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
  options: ConfigureOmniskillCommandOptions,
): void {
  command
    .command("onboard")
    .description("Step through RTK and CodeGraph setup for this workspace.")
    .option("--dir <dir>", "project directory to onboard", options.rootDir)
    .action((commandOptions: { dir: string }) => runOmniskillOnboard(commandOptions, options));
}

async function runOmniskillOnboard(
  commandOptions: { dir: string },
  options: ConfigureOmniskillCommandOptions,
): Promise<void> {
  const targetDir = resolvePath(options.rootDir, commandOptions.dir);
  if (!existsSync(targetDir)) {
    throw new Error(`Onboard target directory does not exist: ${targetDir}`);
  }

  const prompt = options.onboardPrompt ?? createDefaultOnboardPrompt();
  const runCommand = options.onboardCommandRunner ?? runExternalSkillCommand;

  console.log(success("Omniskills onboard"));
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

  console.log(success("Omniskills onboard complete"));
}

function printRtkSetupGuidance(): void {
  console.log(success("RTK setup guidance"));
  console.log("Install or enable RTK, then verify it with:");
  console.log(commandText("rtk --version"));
}

async function runCodeGraphInit(input: {
  targetDir: string;
  runCommand: OmniskillOnboardCommandRunner;
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

function createDefaultOnboardPrompt(): OmniskillOnboardPrompt {
  return {
    confirm: async (input) => {
      const result = await clackConfirm({
        message: input.message,
        initialValue: input.defaultValue,
      });

      if (isCancel(result)) {
        clackCancel("Omniskills onboard cancelled");
        throw new Error("Omniskills onboard cancelled");
      }

      return result;
    },
  };
}

function createDefaultInstallPrompt(): OmniskillInstallPrompt {
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
        clackCancel("Omniskills install cancelled");
        return false;
      }

      return result;
    },
  };
}

function createDefaultRemovePrompt(): OmniskillRemovePrompt {
  return {
    confirmRemove: async (input) => {
      if (!process.stdin.isTTY) {
        console.log(muted("Non-interactive shell detected; pass --yes to remove."));
        return false;
      }

      const result = await clackConfirm({
        message: `Remove ${input.workflowName} and ${input.artifactsToRemove} skill artifacts?`,
        initialValue: false,
      });

      if (isCancel(result)) {
        clackCancel("Omniskills remove cancelled");
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
