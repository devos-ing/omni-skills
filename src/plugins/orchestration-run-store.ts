import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type DispatchAttempt,
  DispatchAttemptSchema,
  type DispatchPlanSet,
  DispatchPlanSetSchema,
  type DispatchReceipt,
  DispatchReceiptSchema,
  type DispatchRequest,
  DispatchRequestSchema,
} from "../runtimes/omniskill/orchestration-dispatch";

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

async function atomicWriteText(path: string, value: string): Promise<void> {
  const temporaryPath = `${path}.tmp-${randomUUID()}`;
  await writeFile(temporaryPath, value, "utf8");
  await rename(temporaryPath, path);
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await atomicWriteText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function parseJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

async function withRunLock<T>(runDir: string, action: () => Promise<T>): Promise<T> {
  const lockDir = join(runDir, ".attempts.lock");
  for (let attempt = 0; attempt < 250; attempt += 1) {
    try {
      await mkdir(lockDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const stale = await stat(lockDir)
        .then((entry) => Date.now() - entry.mtimeMs > 30_000)
        .catch((statError: unknown) => {
          if ((statError as NodeJS.ErrnoException).code === "ENOENT") return false;
          throw statError;
        });
      if (stale) {
        await rm(lockDir, { recursive: true, force: true });
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
      continue;
    }
    try {
      return await action();
    } finally {
      await rm(lockDir, { recursive: true, force: true });
    }
  }
  throw new Error(`Timed out waiting for orchestration run lock: ${runDir}`);
}

function assertRunLink(runId: string, recordRunId: string, recordType: string): void {
  if (recordRunId !== runId) {
    throw new Error(`${recordType} run id ${recordRunId} does not match ${runId}`);
  }
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
        ...(planSet.primary.modelRole ? { modelRole: planSet.primary.modelRole } : {}),
        model: planSet.primary.model,
        effort: planSet.primary.effort,
        access: planSet.primary.access,
        candidateIndex: planSet.primary.candidateIndex,
        candidateCount: planSet.primary.candidateCount,
        workspaceWriteApproved: planSet.primary.workspaceWriteApproved,
        evidence: "requested",
        adapter: planSet.primary.adapter,
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
      const attemptsPath = join(runDir, "attempts.jsonl");
      const parsedAttempt = DispatchAttemptSchema.parse(attempt);
      assertRunLink(runId, parsedAttempt.runId, "Dispatch attempt");
      await withRunLock(runDir, async () => {
        const current = await readFile(attemptsPath, "utf8");
        await atomicWriteText(attemptsPath, `${current}${JSON.stringify(parsedAttempt)}\n`);
      });
    },

    async finish(runId, receipt) {
      const runDir = await findRunDir(runId);
      const parsedReceipt = DispatchReceiptSchema.parse(receipt);
      assertRunLink(runId, parsedReceipt.runId, "Dispatch receipt");
      await atomicWriteJson(join(runDir, "receipt.json"), parsedReceipt);
    },

    async load(runId) {
      const runDir = await findRunDir(runId);
      const [requestJson, planJson, attemptsJson, receiptJson] = await Promise.all([
        readFile(join(runDir, "request.json"), "utf8"),
        readFile(join(runDir, "plan.json"), "utf8"),
        readFile(join(runDir, "attempts.jsonl"), "utf8"),
        readFile(join(runDir, "receipt.json"), "utf8"),
      ]);
      const request = DispatchRequestSchema.parse(parseJson(requestJson));
      const planSet = DispatchPlanSetSchema.parse(parseJson(planJson));
      const attempts = attemptsJson
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => DispatchAttemptSchema.parse(parseJson(line)));
      const receipt = DispatchReceiptSchema.parse(parseJson(receiptJson));
      assertRunLink(runId, receipt.runId, "Dispatch receipt");
      for (const attempt of attempts) assertRunLink(runId, attempt.runId, "Dispatch attempt");
      if (
        request.workflow !== planSet.primary.workflow ||
        request.workflow !== receipt.workflow ||
        request.runtime !== planSet.primary.runtime ||
        request.runtime !== receipt.runtime
      ) {
        throw new Error(`Orchestration run records are inconsistent: ${runId}`);
      }
      return {
        request,
        planSet,
        attempts,
        receipt,
        runDir,
      };
    },
  };
}
