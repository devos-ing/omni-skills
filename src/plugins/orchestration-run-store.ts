import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  DispatchAttempt,
  DispatchPlanSet,
  DispatchReceipt,
  DispatchRequest,
} from "../runtimes/omniskill";

export interface StoredDispatchRun {
  request: DispatchRequest;
  planSet: DispatchPlanSet;
  attempts: DispatchAttempt[];
  receipt: DispatchReceipt;
  runDir: string;
}

export interface OrchestrationRunStore {
  create(input: { request: DispatchRequest; planSet: DispatchPlanSet }): Promise<DispatchReceipt>;
  appendAttempt(runId: string, attempt: DispatchAttempt): Promise<void>;
  finish(runId: string, receipt: DispatchReceipt): Promise<void>;
  load(runId: string): Promise<StoredDispatchRun>;
}

interface RunStoreOptions {
  homeDir: string;
  now?: () => Date;
  createRunId?: () => string;
}

function assertSafeRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) {
    throw new Error(`Invalid orchestration run id: ${runId}`);
  }
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.tmp-${randomUUID()}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

export function createOrchestrationRunStore(input: RunStoreOptions): OrchestrationRunStore {
  const runsDir = join(input.homeDir, ".omniskills", "runs");
  const now = input.now ?? (() => new Date());
  const createRunId = input.createRunId ?? randomUUID;

  async function findRunDir(runId: string): Promise<string> {
    assertSafeRunId(runId);
    const workflows = await readdir(runsDir, { withFileTypes: true }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
    for (const workflow of workflows) {
      if (!workflow.isDirectory()) continue;
      const candidate = join(runsDir, workflow.name, runId);
      const entries = await readdir(candidate).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      });
      if (entries) return candidate;
    }
    throw new Error(`Orchestration run not found: ${runId}`);
  }

  return {
    async create({ request, planSet }) {
      const runId = createRunId();
      assertSafeRunId(runId);
      const runDir = join(runsDir, request.workflow, runId);
      const timestamp = now().toISOString();
      const receipt: DispatchReceipt = {
        schemaVersion: "0.1",
        runId,
        workflow: planSet.primary.workflow,
        role: planSet.primary.role,
        profileId: planSet.primary.profileId,
        profileHash: planSet.primary.profileHash,
        runtime: planSet.primary.runtime,
        tier: planSet.primary.tier,
        model: planSet.primary.model,
        effort: planSet.primary.effort,
        access: planSet.primary.access,
        evidence: "requested",
        adapter: "codex-cli",
        status: "planned",
        consultationCount: 0,
        reassignmentCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await mkdir(runDir, { recursive: true });
      await atomicWriteJson(join(runDir, "request.json"), request);
      await atomicWriteJson(join(runDir, "plan.json"), planSet);
      await writeFile(join(runDir, "attempts.jsonl"), "", "utf8");
      await atomicWriteJson(join(runDir, "receipt.json"), receipt);
      return receipt;
    },

    async appendAttempt(runId, attempt) {
      const runDir = await findRunDir(runId);
      await appendFile(join(runDir, "attempts.jsonl"), `${JSON.stringify(attempt)}\n`, "utf8");
    },

    async finish(runId, receipt) {
      const runDir = await findRunDir(runId);
      await atomicWriteJson(join(runDir, "receipt.json"), receipt);
    },

    async load(runId) {
      const runDir = await findRunDir(runId);
      const [requestJson, planJson, attemptsJson, receiptJson] = await Promise.all([
        readFile(join(runDir, "request.json"), "utf8"),
        readFile(join(runDir, "plan.json"), "utf8"),
        readFile(join(runDir, "attempts.jsonl"), "utf8"),
        readFile(join(runDir, "receipt.json"), "utf8"),
      ]);
      return {
        request: JSON.parse(requestJson) as DispatchRequest,
        planSet: JSON.parse(planJson) as DispatchPlanSet,
        attempts: attemptsJson
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => JSON.parse(line) as DispatchAttempt),
        receipt: JSON.parse(receiptJson) as DispatchReceipt,
        runDir,
      };
    },
  };
}
