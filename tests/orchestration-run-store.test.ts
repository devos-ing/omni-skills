import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOrchestrationRunStore } from "../src/plugins/orchestration-run-store";
import type {
  DispatchAttempt,
  DispatchPlan,
  DispatchPlanSet,
  DispatchReceipt,
  DispatchRequest,
} from "../src/runtimes/omniskill";

function dispatchFixture(homeDir: string): {
  request: DispatchRequest;
  planSet: DispatchPlanSet;
} {
  const request: DispatchRequest = {
    workflow: "startup-team",
    role: "catalog:cto",
    task: "Review boundaries",
    cwd: "/tmp/project",
    homeDir,
    runtime: "codex",
    approveWorkspaceWrite: false,
  };
  const primary: DispatchPlan = {
    workflow: request.workflow,
    role: request.role,
    task: request.task,
    cwd: request.cwd,
    homeDir,
    profileId: "omniskills-startup-team-cto",
    profilePath: join(homeDir, ".codex", "agents", "omniskills-startup-team-cto.toml"),
    profileHash: "profile-hash",
    runtime: "codex",
    tier: "deep",
    model: "gpt-5.6",
    effort: "high",
    access: "read-only",
    instructions: "You are the CTO.",
    consultation: "request",
    limits: {
      retryPerCandidate: 1,
      reassignmentPerWorkItem: 1,
      consultationsPerAgent: 2,
    },
    candidateIndex: 0,
    candidateCount: 1,
    evidenceRequired: "launch_configured",
    workspaceWriteApproved: false,
  };
  return { request, planSet: { primary, candidates: [primary] } };
}

describe("orchestration run store", () => {
  test("atomically persists a complete dispatch run and reloads it", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-run-store-"));
    const { request, planSet } = dispatchFixture(homeDir);
    const store = createOrchestrationRunStore({
      homeDir,
      now: () => new Date("2026-07-15T00:00:00.000Z"),
      createRunId: () => "run-1",
    });

    try {
      const planned = await store.create({ request, planSet });
      const attempt: DispatchAttempt = {
        attemptNumber: 1,
        candidateIndex: 0,
        profileId: planSet.primary.profileId,
        model: planSet.primary.model,
        status: "completed",
        evidence: "launch_configured",
        sessionId: "thread-1",
      };
      const completed: DispatchReceipt = {
        ...planned,
        status: "completed",
        evidence: "launch_configured",
        sessionId: "thread-1",
        updatedAt: "2026-07-15T00:01:00.000Z",
      };

      await store.appendAttempt(planned.runId, attempt);
      await store.finish(planned.runId, completed);

      const loaded = await store.load(planned.runId);
      expect(loaded).toEqual({
        request,
        planSet,
        attempts: [attempt],
        receipt: completed,
        runDir: join(homeDir, ".omniskills", "runs", "startup-team", "run-1"),
      });
      expect(JSON.parse(await readFile(join(loaded.runDir, "request.json"), "utf8"))).toEqual(
        request,
      );
      expect(JSON.parse(await readFile(join(loaded.runDir, "plan.json"), "utf8"))).toEqual(planSet);
      expect(await readFile(join(loaded.runDir, "attempts.jsonl"), "utf8")).toBe(
        `${JSON.stringify(attempt)}\n`,
      );
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("rejects unsafe run ids before searching run state", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-run-store-safe-"));
    const store = createOrchestrationRunStore({ homeDir });
    try {
      await expect(store.load("../receipt")).rejects.toThrow("Invalid orchestration run id");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
