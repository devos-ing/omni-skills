import { constants } from "node:fs";
import { access, appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const commandNames = new Set(["start", "status", "log", "advance", "summary"]);
const eventTypes = new Set([
  "start",
  "status",
  "question",
  "answer",
  "approval",
  "phase_result",
  "error",
  "summary",
  "advance",
  "force_advance",
  "complete",
]);

export async function runWorkflowLoopCli(input = {}) {
  const stdout = input.stdout ?? ((value) => process.stdout.write(value));
  const stderr = input.stderr ?? ((value) => process.stderr.write(value));

  try {
    const parsed = parseArgs(input.argv ?? process.argv.slice(2));
    if (!parsed.command || !commandNames.has(parsed.command)) {
      throw new Error(
        `Usage: ${formatInputCommand(input, "<start|status|log|advance|summary>")} [options]`,
      );
    }

    const manifestPath = resolveManifestPath(input.workflowJson, parsed.options.workflowJson);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const context = {
      manifest,
      manifestPath,
      workflowDir: dirname(manifestPath),
      workflowName: manifest.name,
      runsRoot: join(input.homeDir ?? homedir(), ".getsuperpower", "runs", manifest.name),
      json: parsed.options.json === true,
      cwd: input.cwd ?? process.cwd(),
      stdout,
      commandPrefix:
        typeof input.commandPrefix === "function" ? input.commandPrefix : defaultCommandPrefix,
    };

    await runCommand(context, parsed.command, parsed.options);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr(`${message}\n`);
    return 1;
  }
}

async function runCommand(context, command, options) {
  switch (command) {
    case "start":
      await startRun(context, options);
      return;
    case "status":
      await showStatus(context, options);
      return;
    case "log":
      await logEventCommand(context, options);
      return;
    case "advance":
      await advanceRun(context, options);
      return;
    case "summary":
      await writeSummaryCommand(context, options);
      return;
    default:
      throw new Error(`Unknown loop command: ${command}`);
  }
}

function resolveManifestPath(workflowJson, override) {
  if (override) {
    return resolve(override);
  }
  if (workflowJson instanceof URL) {
    return fileURLToPath(workflowJson);
  }
  if (typeof workflowJson === "string") {
    return resolve(workflowJson);
  }
  return fileURLToPath(new URL("./workflow.json", import.meta.url));
}

async function startRun(context, options) {
  const now = new Date();
  const runId = options.run ?? createRunId(now, context.workflowName);
  const runDir = runPath(context, runId);
  if (await pathExists(runDir)) {
    throw new Error(`Run already exists: ${runId}`);
  }

  const state = {
    schemaVersion: "0.1",
    workflow: context.workflowName,
    runId,
    status: "active",
    currentStepIndex: 0,
    currentStep: context.manifest.steps[0]?.id ?? null,
    goal: buildGoalPayload(context),
    cwd: context.cwd,
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await mkdir(runDir, { recursive: true });
  await writeState(context, state);
  await appendEvent(context, runId, {
    timestamp: now.toISOString(),
    type: "start",
    step: state.currentStep,
    message: `Started ${context.workflowName}`,
    metadata: { cwd: state.cwd },
  });

  writeOutput(context, buildStatusPayload(context, state));
}

async function showStatus(context, options) {
  const runId = await resolveRunId(context, options);
  const state = await readState(context, runId);
  const step = getCurrentStep(context, state);

  await appendEvent(context, runId, {
    timestamp: new Date().toISOString(),
    type: "status",
    step: step?.id ?? null,
    message: step ? `Status requested for ${step.id}` : "Status requested for completed run",
    metadata: { selectedByLatest: options.latest === true },
  });

  writeOutput(context, buildStatusPayload(context, state, { selectedByLatest: options.latest }));
}

async function logEventCommand(context, options) {
  const runId = requireOption(options, "run", "log requires --run <id>");
  const type = requireOption(options, "type", "log requires --type <event-type>");
  if (!eventTypes.has(type)) {
    throw new Error(`Unsupported event type: ${type}`);
  }

  const state = await readState(context, runId);
  const metadata = options.metadata ? parseJsonOption(options.metadata, "--metadata") : {};
  const step = options.step ?? state.currentStep;
  await appendEvent(context, runId, {
    timestamp: new Date().toISOString(),
    type,
    step,
    message: options.message ?? "",
    metadata,
  });
  await touchState(context, state);

  writeOutput(context, {
    workflow: context.workflowName,
    runId,
    event: { type, step, message: options.message ?? "", metadata },
    actions: buildActions(context, state),
  });
}

async function advanceRun(context, options) {
  const runId = requireOption(options, "run", "advance requires --run <id>");
  const state = await readState(context, runId);
  const now = new Date().toISOString();
  const previousStep = getCurrentStep(context, state);

  if (options.to) {
    if (options.force !== true) {
      throw new Error("advance --to requires --force and --reason");
    }
    const reason = requireOption(options, "reason", "advance --to requires --force and --reason");
    const targetIndex = context.manifest.steps.findIndex((step) => step.id === options.to);
    if (targetIndex < 0) {
      throw new Error(`Unknown workflow step: ${options.to}`);
    }
    state.currentStepIndex = targetIndex;
    state.currentStep = context.manifest.steps[targetIndex].id;
    state.status = "active";
    state.updatedAt = now;
    await writeState(context, state);
    await appendEvent(context, runId, {
      timestamp: now,
      type: "force_advance",
      step: state.currentStep,
      message: reason,
      metadata: { from: previousStep?.id ?? null, to: state.currentStep },
    });
    writeOutput(context, buildStatusPayload(context, state));
    return;
  }

  const nextIndex = state.currentStepIndex + 1;
  if (nextIndex >= context.manifest.steps.length) {
    state.currentStepIndex = context.manifest.steps.length;
    state.currentStep = null;
    state.status = "complete";
    state.completedAt = now;
    state.updatedAt = now;
    await writeState(context, state);
    await appendEvent(context, runId, {
      timestamp: now,
      type: "complete",
      step: previousStep?.id ?? null,
      message: `Completed ${context.workflowName}`,
      metadata: {},
    });
    writeOutput(context, buildStatusPayload(context, state));
    return;
  }

  state.currentStepIndex = nextIndex;
  state.currentStep = context.manifest.steps[nextIndex].id;
  state.updatedAt = now;
  await writeState(context, state);
  await appendEvent(context, runId, {
    timestamp: now,
    type: "advance",
    step: state.currentStep,
    message: `Advanced to ${state.currentStep}`,
    metadata: { from: previousStep?.id ?? null, to: state.currentStep },
  });

  writeOutput(context, buildStatusPayload(context, state));
}

async function writeSummaryCommand(context, options) {
  const runId = await resolveRunId(context, options);
  const state = await readState(context, runId);
  const events = await readEvents(context, runId);
  const summary = buildSummary(context, state, events);
  const summaryPath = join(runPath(context, runId), "summary.md");

  await writeFile(summaryPath, summary);
  await appendEvent(context, runId, {
    timestamp: new Date().toISOString(),
    type: "summary",
    step: state.currentStep,
    message: "Generated mechanical summary",
    metadata: { path: summaryPath },
  });
  await touchState(context, state);

  writeOutput(context, {
    workflow: context.workflowName,
    runId,
    summaryPath,
    actions: buildActions(context, state),
  });
}

function buildStatusPayload(context, state, extra = {}) {
  const step = getCurrentStep(context, state);
  return {
    workflow: context.workflowName,
    runId: state.runId,
    status: state.status,
    selectedByLatest: extra.selectedByLatest === true,
    step: step
      ? {
          id: step.id,
          title: step.title,
          skill: step.skill,
          gate: step.gate ?? null,
          instruction: step.instruction ?? "",
          verify: step.verify ?? null,
          index: state.currentStepIndex,
        }
      : null,
    instruction: step?.instruction ?? "Workflow is complete.",
    goal: buildGoalPayload(context),
    actions: buildActions(context, state),
  };
}

function buildGoalPayload(context) {
  const loop = context.manifest.loop;
  if (!loop?.goal) {
    return null;
  }
  return {
    type: loop.type ?? "goal_based",
    goal: loop.goal,
    done_when: loop.done_when ?? [],
    stop_when: loop.stop_when ?? [],
  };
}

function buildActions(context, state) {
  const step = getCurrentStep(context, state);
  if (!step) {
    return [
      {
        type: "summary",
        command: `${formatCommand(context, "summary")} --run ${state.runId}`,
        description: "Generate or refresh the mechanical workflow summary.",
      },
    ];
  }

  return [
    {
      type: "run_phase",
      step: step.id,
      skill: step.skill,
      instruction: step.instruction ?? "",
      description: "Use the named skill and perform the phase work yourself.",
    },
    {
      type: "log_event",
      command: `${formatCommand(context, "log")} --run ${state.runId} --type phase_result --message "..."`,
      description: "Record what happened before advancing.",
    },
    ...(step.verify
      ? [
          {
            type: "verify",
            step: step.id,
            verify: step.verify,
            description: "Check the phase verification rule before advancing.",
          },
        ]
      : []),
    {
      type: "advance",
      command: `${formatCommand(context, "advance")} --run ${state.runId}`,
      description:
        step.gate === "human_approval"
          ? "Run only after explicit human approval."
          : "Run when the phase is done.",
    },
  ];
}

function buildSummary(context, state, events) {
  const approvals = events.filter((event) => event.type === "approval");
  const errors = events.filter((event) => event.type === "error");
  const forceAdvances = events.filter((event) => event.type === "force_advance");
  const latestPhaseResult = [...events].reverse().find((event) => event.type === "phase_result");
  const goal = buildGoalPayload(context);
  const completedSteps = context.manifest.steps
    .slice(0, Math.min(state.currentStepIndex, context.manifest.steps.length))
    .map((step) => `- ${step.id}: ${step.title}`);

  return [
    `# ${context.workflowName} Run ${state.runId}`,
    "",
    `Status: ${state.status}`,
    `Current step: ${state.currentStep ?? "complete"}`,
    "",
    "## Goal",
    goal ? formatGoal(goal) : "- none",
    "",
    "## Completed Steps",
    completedSteps.length > 0 ? completedSteps.join("\n") : "- none",
    "",
    "## Approvals",
    formatEvents(approvals),
    "",
    "## Errors",
    formatEvents(errors),
    "",
    "## Force Advances",
    formatEvents(forceAdvances),
    "",
    "## Latest Phase Result",
    latestPhaseResult ? formatEvent(latestPhaseResult) : "- none",
    "",
    "## Next Action",
    buildActions(context, state)
      .map((action) => `- ${action.type}: ${action.description}`)
      .join("\n"),
    "",
  ].join("\n");
}

function formatGoal(goal) {
  return [
    `Goal: ${goal.goal}`,
    `Type: ${goal.type}`,
    ...goal.done_when.map((condition) => `- done_when: ${condition}`),
    ...goal.stop_when.map((condition) => `- stop_when: ${condition}`),
  ].join("\n");
}

function formatEvents(events) {
  return events.length > 0 ? events.map(formatEvent).join("\n") : "- none";
}

function formatEvent(event) {
  return `- ${event.timestamp} ${event.step ?? "workflow"} ${event.message}`;
}

async function resolveRunId(context, options) {
  if (options.run) {
    return options.run;
  }
  if (options.latest === true) {
    return latestActiveRunId(context);
  }
  throw new Error("Pass --run <id> or --latest.");
}

async function latestActiveRunId(context) {
  if (!(await pathExists(context.runsRoot))) {
    throw new Error(
      `No active runs found for ${context.workflowName}. Start one with: ${formatCommand(context, "start")}`,
    );
  }

  const entries = await readdir(context.runsRoot, { withFileTypes: true });
  const states = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const state = await readState(context, entry.name);
      if (state.status === "active") {
        states.push(state);
      }
    } catch {
      // Ignore partial or unrelated run folders.
    }
  }

  states.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const latest = states[0];
  if (!latest) {
    throw new Error(
      `No active runs found for ${context.workflowName}. Start one with: ${formatCommand(context, "start")}`,
    );
  }
  return latest.runId;
}

function getCurrentStep(context, state) {
  if (state.status === "complete") {
    return null;
  }
  return context.manifest.steps[state.currentStepIndex] ?? null;
}

async function readState(context, runId) {
  return JSON.parse(await readFile(join(runPath(context, runId), "state.json"), "utf8"));
}

async function writeState(context, state) {
  const runDir = runPath(context, state.runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "state.json"), `${JSON.stringify(state, null, 2)}\n`);
}

async function touchState(context, state) {
  state.updatedAt = new Date().toISOString();
  await writeState(context, state);
}

async function appendEvent(context, runId, event) {
  const runDir = runPath(context, runId);
  await mkdir(runDir, { recursive: true });
  await appendFile(join(runDir, "events.jsonl"), `${JSON.stringify(event)}\n`);
}

async function readEvents(context, runId) {
  const path = join(runPath(context, runId), "events.jsonl");
  if (!(await pathExists(path))) {
    return [];
  }
  const content = await readFile(path, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function runPath(context, runId) {
  return join(context.runsRoot, sanitizePathSegment(runId));
}

function createRunId(date, workflowName) {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  return `${stamp}-${sanitizePathSegment(workflowName)}`;
}

function sanitizePathSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "-");
}

function parseJsonOption(value, name) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
}

function requireOption(options, name, message) {
  const value = options[name];
  if (value === undefined || value === "") {
    throw new Error(message);
  }
  return value;
}

function formatInputCommand(input, command) {
  if (typeof input.commandPrefix === "function") {
    return input.commandPrefix(command);
  }
  return defaultCommandPrefix(command);
}

function formatCommand(context, command) {
  return context.commandPrefix(command);
}

function defaultCommandPrefix(command) {
  return `node loop.mjs ${command}`;
}

function writeOutput(context, payload) {
  if (context.json) {
    context.stdout(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const lines = [];
  const step = payload.step;
  lines.push(`${payload.workflow} ${payload.runId}`);
  lines.push(`Status: ${payload.status ?? "ok"}`);
  if (step) {
    if (payload.goal?.goal) {
      lines.push(`Goal: ${payload.goal.goal}`);
    }
    lines.push(`Step: ${step.id} - ${step.title}`);
    lines.push(`Skill: ${step.skill}`);
    lines.push(`Instruction: ${step.instruction}`);
    if (step.verify) {
      lines.push(`Verify: ${formatVerifyRule(step.verify)}`);
    }
  } else if (payload.instruction) {
    lines.push(`Instruction: ${payload.instruction}`);
  }
  if (payload.summaryPath) {
    lines.push(`Summary: ${payload.summaryPath}`);
  }
  lines.push("Actions:");
  for (const action of payload.actions ?? []) {
    lines.push(`- ${action.type}: ${action.description}`);
  }
  context.stdout(`${lines.join("\n")}\n`);
}

function formatVerifyRule(verify) {
  const parts = [`type=${verify.type}`];
  if (verify.event) {
    parts.push(`event=${verify.event}`);
  }
  if (verify.message_includes) {
    parts.push(`message_includes=${verify.message_includes}`);
  }
  if (verify.description) {
    parts.push(`description=${verify.description}`);
  }
  return parts.join(" ");
}

function parseArgs(args) {
  const [command, ...rest] = args;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const name = toCamelCase(arg.slice(2));
    if (["json", "latest", "force"].includes(name)) {
      options[name] = true;
      continue;
    }

    const value = rest[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    options[name] = value;
    index += 1;
  }

  return { command, options };
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
