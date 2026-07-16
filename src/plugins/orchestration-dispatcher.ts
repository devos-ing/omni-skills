import type { SubprocessCommand, SubprocessResult } from "../process";
import {
  type ConsultationDecision,
  type ConsultationRequest,
  ConsultationRequestSchema,
  type DispatchFailureCode,
  type DispatchPlan,
} from "../runtimes/omniskill/orchestration-dispatch";

export interface DispatchAttemptResult {
  status: "completed" | "failed" | "consultation_required";
  evidence: "launch_configured" | "runtime_reported";
  sessionId?: string;
  runtimeModel?: string;
  failureCode?: DispatchFailureCode;
  failureReason?: string;
  consultation?: ConsultationRequest;
}

export interface OrchestrationDispatcher {
  readonly runtime: "codex";
  readonly adapter: "codex-cli";
  readonly evidenceCapability: "launch_configured";
  available(cwd: string): Promise<boolean>;
  dispatch(plan: DispatchPlan): Promise<DispatchAttemptResult>;
  resume(input: {
    plan: DispatchPlan;
    sessionId: string;
    decision: ConsultationDecision;
    message: string;
  }): Promise<DispatchAttemptResult>;
}

export type OrchestrationDispatchCommandRunner = (
  command: SubprocessCommand,
) => Promise<SubprocessResult>;

type StructuredEvent = Record<string, unknown> & { type?: unknown };

function parseEvent(line: string): StructuredEvent | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as StructuredEvent) : null;
  } catch {
    return null;
  }
}

function eventsFrom(stdout: string): StructuredEvent[] {
  return stdout
    .split(/\r?\n/)
    .map(parseEvent)
    .filter((event): event is StructuredEvent => event !== null);
}

function findString(event: StructuredEvent, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function findConsultation(events: StructuredEvent[]): ConsultationRequest | undefined {
  for (const event of events) {
    if (event.type !== "item.completed") continue;
    const item = event.item;
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as Record<string, unknown>;
    if (candidate.type !== "agent_message" || typeof candidate.text !== "string") continue;
    try {
      const parsed = ConsultationRequestSchema.safeParse(JSON.parse(candidate.text));
      if (parsed.success) return parsed.data;
    } catch {
      // Agent messages are ordinary text unless they match the strict consultation contract.
    }
  }
  return undefined;
}

function classifyFailure(
  output: string,
): Pick<DispatchAttemptResult, "failureCode" | "failureReason"> {
  if (/requires a newer version of Codex/i.test(output)) {
    return { failureCode: "runtime_upgrade_required", failureReason: output.trim() };
  }
  if (/model .+ (?:is not available|not found|unsupported)/i.test(output)) {
    return { failureCode: "model_unavailable", failureReason: output.trim() };
  }
  return {
    failureCode: "runtime_failed",
    failureReason: output.trim() || "Codex dispatch failed without diagnostic output",
  };
}

function classifyResult(plan: DispatchPlan, result: SubprocessResult): DispatchAttemptResult {
  const events = eventsFrom(result.stdout);
  const thread = events.find((event) => event.type === "thread.started");
  const modelEvent = events.find((event) => event.type === "model.selected");
  const sessionId = thread ? findString(thread, "thread_id", "threadId") : undefined;
  const runtimeModel = modelEvent ? findString(modelEvent, "model") : undefined;
  const evidence = runtimeModel ? "runtime_reported" : "launch_configured";
  if (runtimeModel && runtimeModel !== plan.model) {
    return {
      status: "failed",
      evidence,
      runtimeModel,
      failureCode: "runtime_mismatch",
      failureReason: `Runtime reported ${runtimeModel}; dispatch required ${plan.model}`,
      ...(sessionId ? { sessionId } : {}),
    };
  }
  if (result.exitCode !== 0) {
    return {
      status: "failed",
      evidence,
      ...(runtimeModel ? { runtimeModel } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...classifyFailure([result.stderr, result.stdout].filter(Boolean).join("\n")),
    };
  }
  const consultation = findConsultation(events);
  if (consultation) {
    if (!sessionId) {
      return {
        status: "failed",
        evidence,
        failureCode: "runtime_failed",
        failureReason: "Codex returned a consultation without a resumable session id",
        ...(runtimeModel ? { runtimeModel } : {}),
      };
    }
    return {
      status: "consultation_required",
      evidence,
      consultation,
      sessionId,
      ...(runtimeModel ? { runtimeModel } : {}),
    };
  }
  return {
    status: "completed",
    evidence,
    ...(sessionId ? { sessionId } : {}),
    ...(runtimeModel ? { runtimeModel } : {}),
  };
}

function configArg(key: string, value: string): string {
  return `${key}=${JSON.stringify(value)}`;
}

function configuredModelArgs(plan: DispatchPlan): string[] {
  return [
    "-m",
    plan.model,
    "-c",
    configArg("model_reasoning_effort", plan.effort),
    "-c",
    configArg("developer_instructions", plan.instructions),
  ];
}

export function createCodexCliDispatcher(
  runCommand: OrchestrationDispatchCommandRunner,
  onEvent: (event: StructuredEvent) => void = () => {},
): OrchestrationDispatcher {
  const streamEvent = (line: string) => {
    const event = parseEvent(line);
    if (event) onEvent(event);
  };
  return {
    runtime: "codex",
    adapter: "codex-cli",
    evidenceCapability: "launch_configured",
    async available(cwd) {
      const result = await runCommand({ executable: "codex", args: ["--version"], cwd });
      return result.exitCode === 0;
    },
    async dispatch(plan) {
      return classifyResult(
        plan,
        await runCommand({
          executable: "codex",
          args: [
            "exec",
            "--json",
            "--skip-git-repo-check",
            "-C",
            plan.cwd,
            ...configuredModelArgs(plan),
            "-s",
            plan.access,
            "-",
          ],
          cwd: plan.cwd,
          stdin: plan.task,
          onStdoutLine: streamEvent,
        }),
      );
    },
    async resume(input) {
      return classifyResult(
        input.plan,
        await runCommand({
          executable: "codex",
          args: [
            "exec",
            "resume",
            input.sessionId,
            "--json",
            "--skip-git-repo-check",
            ...configuredModelArgs(input.plan),
            "-c",
            configArg("sandbox_mode", input.plan.access),
            "-",
          ],
          cwd: input.plan.cwd,
          stdin: JSON.stringify({ decision: input.decision, message: input.message }),
          onStdoutLine: streamEvent,
        }),
      );
    },
  };
}
