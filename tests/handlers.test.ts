import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { handleCommand } from "../src/commands/handlers";
import type { LoadedConfig } from "../src/core/config";
import { saveRunState } from "../src/core/state";
import type { ResolvedProjectConfig, RunState } from "../src/core/types";

const originalStdoutWrite = process.stdout.write.bind(process.stdout);

afterEach(() => {
	process.stdout.write = originalStdoutWrite;
});

describe("handleCommand status output", () => {
	it("includes stageDisplay while preserving stage", async () => {
		const workspaceRoot = await mkdtemp(
			path.join(os.tmpdir(), "adhd-handlers-"),
		);
		const project = createProject("default", workspaceRoot);
		const config: LoadedConfig = {
			projects: [project],
			polling: {
				intervalMs: 30000,
				maxCycles: 1,
				exitWhenIdle: true,
				staleRunTimeoutMs: 3600000,
			},
			automations: { jobs: [] },
			cron: { jobs: [] },
			notifications: {
				email: {
					enabled: false,
					resendApiKey: undefined,
					from: undefined,
					to: [],
				},
			},
		};

		await saveRunState(workspaceRoot, createRunState("ROY-64", "planning"));

		const writes: string[] = [];
		process.stdout.write = ((chunk: string | Uint8Array) => {
			writes.push(
				typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(),
			);
			return true;
		}) as typeof process.stdout.write;

		await handleCommand(
			{
				kind: "status",
				projectId: "default",
				issueKey: "roy-64",
			},
			config,
		);

		const parsed = JSON.parse(writes.join("")) as {
			stage: string;
			stageDisplay?: string;
		};
		expect(parsed.stage).toBe("planning");
		expect(parsed.stageDisplay).toBe("planning 🧭");
	});
});

function createProject(
	id: string,
	workspacePath: string,
): ResolvedProjectConfig {
	return {
		id,
		name: id,
		workspacePath,
		executionPath: workspacePath,
		repo: {
			owner: "acme",
			name: "repo",
			baseBranch: "main",
		},
		linear: {
			apiKey: "key",
			apiUrl: "https://api.linear.app/graphql",
			projectId: undefined,
			teamId: undefined,
			requiredLabel: undefined,
			pollLimit: 10,
			statusMap: {
				assigned: "Todo",
				planning: "In Progress",
				implementing: "In Progress",
				pr_created: "In Review",
				reviewing: "In Review",
				testing: "In Review",
				blocked: "Canceled",
				done: "Done",
			},
			labelMap: {
				pr_created: "PR Created",
				reviewing: "Reviewing",
				testing: "Testing",
			},
			autoCreateLabels: true,
		},
		github: {
			useGhCli: true,
			defaultBugLabel: "bug",
		},
		codex: {
			binary: "codex",
			streamLogs: false,
		},
		skills: {
			root: "/tmp/skills",
			plan: "/tmp/plan.md",
			implement: "/tmp/implement.md",
			reviewTest: "/tmp/review.md",
		},
		dryRun: false,
	};
}

function createRunState(issueKey: string, stage: RunState["stage"]): RunState {
	const now = new Date().toISOString();
	return {
		projectId: "default",
		projectName: "Default",
		workspacePath: "/tmp/work",
		repository: {
			owner: "acme",
			name: "repo",
			baseBranch: "main",
		},
		issue: {
			id: `lin_${issueKey}`,
			key: issueKey,
			title: issueKey,
			url: `https://linear.app/acme/issue/${issueKey}/sample`,
		},
		stage,
		bugs: [],
		startedAt: now,
		updatedAt: now,
	};
}
