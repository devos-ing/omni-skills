import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOrchestrationRunStore } from "../src/plugins/orchestration-run-store";
import type {
  DispatchAttempt,
  DispatchPlan,
  DispatchPlanSet,
  DispatchReceipt,
  DispatchRequest,
} from "../src/runtimes/omniskill/orchestration-dispatch";

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
    adapter: "codex-cli",
    evidenceCapability: "launch_configured",
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
      expect(planned).toEqual(
        expect.objectContaining({
          candidateIndex: 0,
          candidateCount: 1,
          workspaceWriteApproved: false,
          adapter: "codex-cli",
        }),
      );
      const attempt: DispatchAttempt = {
        runId: planned.runId,
        plan: planSet.primary,
        attemptNumber: 1,
        candidateIndex: 0,
        profileId: planSet.primary.profileId,
        model: planSet.primary.model,
        status: "completed",
        evidence: "launch_configured",
        sessionId: "thread-1",
        createdAt: "2026-07-15T00:00:00.000Z",
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

  test("rejects malformed persisted request, attempt, and receipt state", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-run-store-invalid-"));
    const { request, planSet } = dispatchFixture(homeDir);
    const store = createOrchestrationRunStore({
      homeDir,
      createRunId: () => "run-invalid",
    });

    try {
      const planned = await store.create({ request, planSet });
      const runDir = join(homeDir, ".omniskills", "runs", "startup-team", planned.runId);

      await writeFile(
        join(runDir, "request.json"),
        `${JSON.stringify({ ...request, runtime: "unknown" })}\n`,
        "utf8",
      );
      await expect(store.load(planned.runId)).rejects.toThrow();
      await writeFile(join(runDir, "request.json"), `${JSON.stringify(request)}\n`, "utf8");

      await writeFile(join(runDir, "attempts.jsonl"), '{"attemptNumber":1}\n', "utf8");
      await expect(store.load(planned.runId)).rejects.toThrow();
      await writeFile(join(runDir, "attempts.jsonl"), "", "utf8");

      await writeFile(
        join(runDir, "receipt.json"),
        `${JSON.stringify({ ...planned, status: "unknown" })}\n`,
        "utf8",
      );
      await expect(store.load(planned.runId)).rejects.toThrow();
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("serializes concurrent attempts and enforces their run linkage", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-run-store-concurrent-"));
    const { request, planSet } = dispatchFixture(homeDir);
    const store = createOrchestrationRunStore({
      homeDir,
      createRunId: () => "run-concurrent",
    });

    try {
      const planned = await store.create({ request, planSet });
      const attempts = Array.from(
        { length: 12 },
        (_, index): DispatchAttempt => ({
          runId: planned.runId,
          plan: planSet.primary,
          attemptNumber: index + 1,
          candidateIndex: 0,
          profileId: planSet.primary.profileId,
          model: planSet.primary.model,
          status: "completed",
          evidence: "launch_configured",
          createdAt: new Date(1_000 + index).toISOString(),
        }),
      );

      await Promise.all(attempts.map((attempt) => store.appendAttempt(planned.runId, attempt)));
      expect((await store.load(planned.runId)).attempts).toHaveLength(attempts.length);

      const firstAttempt = attempts[0];
      if (!firstAttempt) throw new Error("Expected a dispatch attempt fixture");
      await expect(
        store.appendAttempt(planned.runId, { ...firstAttempt, runId: "another-run" }),
      ).rejects.toThrow("does not match");
      await expect(
        store.finish(planned.runId, { ...planned, runId: "another-run" }),
      ).rejects.toThrow("does not match");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
