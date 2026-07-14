import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { buildProgram } from "../cli";

export type CliSandboxEvaluationMode = "baseline" | "workflow";

export interface CliSandboxCriterion {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface CliSandboxCommandRun {
  args: string[];
  activeMs: number;
  failed: boolean;
  logs: string[];
  error?: string;
}

export interface CliSandboxTokenSpend {
  inputTokens?: number;
  outputTokens?: number;
}

export interface CliSandboxRun {
  mode: CliSandboxEvaluationMode;
  label: string;
  projectDir: string;
  homeDir: string;
  activeMs: number;
  cliCommands: number;
  checkRetries: number;
  commandFailures: number;
  externalSideEffects: number;
  criteria: CliSandboxCriterion[];
  commands: CliSandboxCommandRun[];
  tokenSpend: CliSandboxTokenSpend | null;
}

export interface CliSandboxMatrixRow {
  metric: string;
  baseline: string;
  workflow: string;
  delta: string;
}

export interface CliSandboxEvaluationReport {
  generatedAt: string;
  workflowSource: string;
  workflowSourcePath: string;
  sandboxRoot: string;
  runs: [CliSandboxRun, CliSandboxRun];
  matrices: {
    performance: CliSandboxMatrixRow[];
    accuracy: CliSandboxMatrixRow[];
    tokenSpend: CliSandboxMatrixRow[];
  };
}

export interface RunCliSandboxEvaluationOptions {
  generatedAt?: string;
  repoRoot?: string;
  sandboxRoot?: string;
  workflowSource?: string;
}

const defaultWorkflowSource = "examples/workflows/openspec-superpowers";
const expectedInstalledSkills = [
  "openspec-delivery",
  "opsx-handoff-review",
  "superpowers-brainstorming",
  "superpowers-writing-plans",
  "superpowers-verification-before-completion",
  "tdd",
];

export async function runCliSandboxEvaluation(
  options: RunCliSandboxEvaluationOptions = {},
): Promise<CliSandboxEvaluationReport> {
  const repoRoot = options.repoRoot ?? resolve(import.meta.dir, "..", "..");
  const workflowSource = options.workflowSource ?? defaultWorkflowSource;
  const workflowSourcePath = isAbsolute(workflowSource)
    ? workflowSource
    : resolve(repoRoot, workflowSource);
  const sandboxRoot = options.sandboxRoot ?? (await mkdtemp(join(tmpdir(), "omniskill-cli-eval-")));
  await mkdir(sandboxRoot, { recursive: true });

  const baselineRun = await runBaseline({
    projectDir: join(sandboxRoot, "baseline-project"),
    homeDir: join(sandboxRoot, "baseline-home"),
    workflowSourcePath,
  });
  const workflowRun = await runWorkflow({
    projectDir: join(sandboxRoot, "workflow-project"),
    homeDir: join(sandboxRoot, "workflow-home"),
    workflowSourcePath,
  });

  return createEvaluationReport({
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workflowSource,
    workflowSourcePath,
    sandboxRoot,
    runs: [baselineRun, workflowRun],
  });
}

export function renderCliSandboxEvaluation(report: CliSandboxEvaluationReport): string {
  return [
    "# Omniskills CLI Sandbox Evaluation",
    "",
    `Generated: ${report.generatedAt}`,
    `Workflow source: ${report.workflowSource}`,
    `Sandbox root: ${report.sandboxRoot}`,
    "",
    "## Performance Matrix",
    renderMatrix(report.matrices.performance),
    "",
    "## Accuracy Matrix",
    renderMatrix(report.matrices.accuracy),
    "",
    "## Token Spend Matrix",
    renderMatrix(report.matrices.tokenSpend),
    "",
    "Token metrics are unavailable because CLI sandbox runs do not expose provider token metadata.",
    "",
    "## Acceptance Criteria",
    ...report.runs.flatMap((run) => [
      "",
      `### ${run.label}`,
      ...run.criteria.map(
        (criterion) =>
          `- ${criterion.passed ? "PASS" : "FAIL"} ${criterion.label}: ${criterion.detail}`,
      ),
    ]),
    "",
  ].join("\n");
}

function createEvaluationReport(input: {
  generatedAt: string;
  workflowSource: string;
  workflowSourcePath: string;
  sandboxRoot: string;
  runs: [CliSandboxRun, CliSandboxRun];
}): CliSandboxEvaluationReport {
  const [baseline, workflow] = input.runs;

  return {
    generatedAt: input.generatedAt,
    workflowSource: input.workflowSource,
    workflowSourcePath: input.workflowSourcePath,
    sandboxRoot: input.sandboxRoot,
    runs: input.runs,
    matrices: {
      performance: [
        millisecondsRow("Active wall-clock time", baseline.activeMs, workflow.activeMs),
        countRow("CLI commands", baseline.cliCommands, workflow.cliCommands),
        countRow("Check retries", baseline.checkRetries, workflow.checkRetries),
      ],
      accuracy: [
        textRow(
          "Acceptance criteria passed",
          `${countPassedCriteria(baseline)}/${baseline.criteria.length}`,
          `${countPassedCriteria(workflow)}/${workflow.criteria.length}`,
          formatSignedNumber(countPassedCriteria(workflow) - countPassedCriteria(baseline)),
        ),
        percentRow("Acceptance pass rate", criteriaPassRate(baseline), criteriaPassRate(workflow)),
        countRow("CLI command failures", baseline.commandFailures, workflow.commandFailures),
        countRow(
          "External side effects",
          baseline.externalSideEffects,
          workflow.externalSideEffects,
        ),
      ],
      tokenSpend: tokenSpendRows(baseline, workflow),
    },
  };
}

async function runBaseline(input: {
  projectDir: string;
  homeDir: string;
  workflowSourcePath: string;
}): Promise<CliSandboxRun> {
  await mkdir(input.projectDir, { recursive: true });
  await mkdir(input.homeDir, { recursive: true });
  const externalCalls: string[] = [];
  const commands = await runCommands({
    projectDir: input.projectDir,
    externalCalls,
    commands: [
      ["validate", input.workflowSourcePath],
      ["deps", input.workflowSourcePath],
    ],
  });
  const logs = commands.flatMap((command) => command.logs);
  const workflowRecord = join(input.homeDir, ".omniskills", "workflows", "openspec-delivery.json");

  return buildRun({
    mode: "baseline",
    label: "Before workflow install/use",
    projectDir: input.projectDir,
    homeDir: input.homeDir,
    commands,
    externalSideEffects: externalCalls.length,
    criteria: [
      {
        id: "baseline-validates-workflow",
        label: "CLI validates the workflow source",
        passed: logs.some((line) =>
          stripAnsi(line).startsWith("Omniskills valid: openspec-delivery@"),
        ),
        detail: "validate should accept the OpenSpec workflow fixture",
      },
      {
        id: "baseline-lists-dependencies",
        label: "CLI lists workflow dependencies before install",
        passed:
          logs.some((line) => stripAnsi(line).includes("- mattpocock:tdd")) &&
          logs.some((line) =>
            stripAnsi(line).includes("- superpowers:verification-before-completion"),
          ),
        detail: "deps should expose reusable workflow skill requirements",
      },
      {
        id: "baseline-does-not-install",
        label: "Baseline mode leaves the project uninstalled",
        passed: !(await pathExists(workflowRecord)),
        detail: ".omniskills workflow records should not exist before install",
      },
      {
        id: "baseline-no-external-side-effects",
        label: "Baseline mode avoids external side effects",
        passed: externalCalls.length === 0,
        detail: "validate/deps should not invoke the external Skills CLI",
      },
    ],
  });
}

async function runWorkflow(input: {
  projectDir: string;
  homeDir: string;
  workflowSourcePath: string;
}): Promise<CliSandboxRun> {
  await mkdir(input.projectDir, { recursive: true });
  await mkdir(input.homeDir, { recursive: true });
  await writeFakeDependencyHome(input.homeDir);
  const externalCalls: string[] = [];
  const commands = await runCommands({
    projectDir: input.projectDir,
    externalCalls,
    commands: [
      ["install", input.workflowSourcePath, "--home", input.homeDir, "--agents", "codex"],
      ["list", "--home", input.homeDir],
    ],
  });
  const logs = commands.flatMap((command) => command.logs);
  const workflowRecord = join(input.homeDir, ".omniskills", "workflows", "openspec-delivery.json");
  const installedSkillResults = await Promise.all(
    expectedInstalledSkills.map((skill) =>
      pathExists(join(input.homeDir, ".agents", "skills", skill, "SKILL.md")),
    ),
  );

  return buildRun({
    mode: "workflow",
    label: "After workflow install/use",
    projectDir: input.projectDir,
    homeDir: input.homeDir,
    commands,
    externalSideEffects: externalCalls.length,
    criteria: [
      {
        id: "workflow-record-written",
        label: "Workflow mode writes the installed workflow record",
        passed: await pathExists(workflowRecord),
        detail: "global .omniskills/workflows/openspec-delivery.json should exist",
      },
      {
        id: "workflow-installs-skills",
        label: "Workflow mode installs every required skill into the sandbox home",
        passed: installedSkillResults.every(Boolean),
        detail: expectedInstalledSkills.join(", "),
      },
      {
        id: "workflow-list-shows-installed-workflow",
        label: "Workflow mode lists the installed workflow",
        passed: logs.some((line) => stripAnsi(line).startsWith("openspec-delivery ")),
        detail: "list should show the workflow installed by install",
      },
      {
        id: "workflow-no-external-side-effects",
        label: "Workflow mode avoids external side effects in the sandbox",
        passed: externalCalls.length === 0,
        detail: "fake sandbox dependencies should prevent network/package bootstrap",
      },
    ],
  });
}

function buildRun(input: {
  mode: CliSandboxEvaluationMode;
  label: string;
  projectDir: string;
  homeDir: string;
  commands: CliSandboxCommandRun[];
  externalSideEffects: number;
  criteria: CliSandboxCriterion[];
}): CliSandboxRun {
  return {
    mode: input.mode,
    label: input.label,
    projectDir: input.projectDir,
    homeDir: input.homeDir,
    activeMs: sum(input.commands.map((command) => command.activeMs)),
    cliCommands: input.commands.length,
    checkRetries: 0,
    commandFailures: input.commands.filter((command) => command.failed).length,
    externalSideEffects: input.externalSideEffects,
    criteria: input.criteria,
    commands: input.commands,
    tokenSpend: null,
  };
}

async function runCommands(input: {
  projectDir: string;
  externalCalls: string[];
  commands: string[][];
}): Promise<CliSandboxCommandRun[]> {
  const runs: CliSandboxCommandRun[] = [];
  for (const args of input.commands) {
    runs.push(
      await runCommand({ projectDir: input.projectDir, externalCalls: input.externalCalls, args }),
    );
  }
  return runs;
}

async function runCommand(input: {
  projectDir: string;
  externalCalls: string[];
  args: string[];
}): Promise<CliSandboxCommandRun> {
  const logs: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const startedAt = performance.now();
  let failed = false;
  let error: string | undefined;

  console.log = (...values: unknown[]) => {
    logs.push(values.join(" "));
  };
  console.error = (...values: unknown[]) => {
    logs.push(values.join(" "));
  };

  try {
    await buildProgram({
      cwd: input.projectDir,
      installExternalSkillDependency: async (dependency) => {
        input.externalCalls.push(dependency.source);
        throw new Error(`Sandbox blocked external skill install: ${dependency.source}`);
      },
    }).parseAsync(input.args, { from: "user" });
  } catch (caught) {
    failed = true;
    error = caught instanceof Error ? caught.message : String(caught);
    logs.push(`ERROR: ${error}`);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return {
    args: input.args,
    activeMs: performance.now() - startedAt,
    failed,
    logs,
    ...(error ? { error } : {}),
  };
}

async function writeFakeDependencyHome(homeDir: string): Promise<void> {
  const superpowersRoot = join(
    homeDir,
    ".codex",
    "plugins",
    "cache",
    "openai-curated",
    "superpowers",
    "sandbox-plugin",
    "skills",
  );
  await writeSkill(join(superpowersRoot, "brainstorming"), {
    name: "brainstorming",
    description: "Sandbox Superpowers brainstorming skill.",
  });
  await writeSkill(join(superpowersRoot, "writing-plans"), {
    name: "writing-plans",
    description: "Sandbox Superpowers writing-plans skill.",
  });
  await writeSkill(join(superpowersRoot, "verification-before-completion"), {
    name: "verification-before-completion",
    description: "Sandbox Superpowers verification skill.",
  });
  await writeSkill(join(homeDir, ".agents", "skills", "tdd"), {
    name: "tdd",
    description: "Sandbox Matt Pocock TDD skill.",
  });
}

async function writeSkill(
  path: string,
  input: { name: string; description: string },
): Promise<void> {
  await mkdir(path, { recursive: true });
  await writeFile(
    join(path, "SKILL.md"),
    [
      "---",
      `name: ${input.name}`,
      `description: "${input.description}"`,
      "---",
      "",
      `# ${input.name}`,
    ].join("\n"),
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function renderMatrix(rows: CliSandboxMatrixRow[]): string {
  return [
    "| Metric | Baseline | Workflow | Delta |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.metric} | ${row.baseline} | ${row.workflow} | ${row.delta} |`),
  ].join("\n");
}

function tokenSpendRows(baseline: CliSandboxRun, workflow: CliSandboxRun): CliSandboxMatrixRow[] {
  return [
    tokenRow("Input tokens", baseline.tokenSpend?.inputTokens, workflow.tokenSpend?.inputTokens),
    tokenRow("Output tokens", baseline.tokenSpend?.outputTokens, workflow.tokenSpend?.outputTokens),
    tokenRow("Total tokens", totalTokens(baseline.tokenSpend), totalTokens(workflow.tokenSpend)),
    tokenRow(
      "Tokens per accepted criterion",
      tokensPerAcceptedCriterion(baseline),
      tokensPerAcceptedCriterion(workflow),
    ),
  ];
}

function tokenRow(
  metric: string,
  baseline: number | undefined,
  workflow: number | undefined,
): CliSandboxMatrixRow {
  if (baseline === undefined || workflow === undefined) {
    return textRow(metric, "unavailable", "unavailable", "unavailable");
  }

  return countRow(metric, baseline, workflow);
}

function totalTokens(tokens: CliSandboxTokenSpend | null): number | undefined {
  if (!tokens || tokens.inputTokens === undefined || tokens.outputTokens === undefined) {
    return undefined;
  }
  return tokens.inputTokens + tokens.outputTokens;
}

function tokensPerAcceptedCriterion(run: CliSandboxRun): number | undefined {
  const total = totalTokens(run.tokenSpend);
  const passed = countPassedCriteria(run);
  if (total === undefined || passed === 0) {
    return undefined;
  }
  return total / passed;
}

function millisecondsRow(metric: string, baseline: number, workflow: number): CliSandboxMatrixRow {
  return textRow(
    metric,
    `${Math.round(baseline)} ms`,
    `${Math.round(workflow)} ms`,
    `${formatSignedNumber(Math.round(workflow - baseline))} ms`,
  );
}

function countRow(metric: string, baseline: number, workflow: number): CliSandboxMatrixRow {
  return textRow(
    metric,
    formatNumber(baseline),
    formatNumber(workflow),
    formatSignedNumber(workflow - baseline),
  );
}

function percentRow(metric: string, baseline: number, workflow: number): CliSandboxMatrixRow {
  return textRow(
    metric,
    `${formatNumber(baseline)}%`,
    `${formatNumber(workflow)}%`,
    `${formatSignedNumber(workflow - baseline)} pp`,
  );
}

function textRow(
  metric: string,
  baseline: string,
  workflow: string,
  delta: string,
): CliSandboxMatrixRow {
  return { metric, baseline, workflow, delta };
}

function criteriaPassRate(run: CliSandboxRun): number {
  if (run.criteria.length === 0) {
    return 100;
  }
  return (countPassedCriteria(run) / run.criteria.length) * 100;
}

function countPassedCriteria(run: CliSandboxRun): number {
  return run.criteria.filter((criterion) => criterion.passed).length;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatSignedNumber(value: number): string {
  if (value > 0) {
    return `+${formatNumber(value)}`;
  }
  return formatNumber(value);
}

function stripAnsi(value: string): string {
  const escapeCharacter = String.fromCharCode(27);
  return value.replace(new RegExp(`${escapeCharacter}\\[[0-?]*[ -/]*[@-~]`, "g"), "");
}
