import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	handleCommand,
	printHelp,
	resolveTaskCreateRequest,
} from "../src/commands/handlers";
import type { LoadedConfig } from "../src/features/config";
import type { ResolvedProjectConfig, RunState } from "../src/features/types";
import { loadRunState, saveRunState } from "../src/features/workflow/state";
import { LinearClient } from "../src/integrations/linear";

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

describe("resolveTaskCreateRequest", () => {
	it("uses prompted request when missing", async () => {
		const request = await resolveTaskCreateRequest({
			request: undefined,
			askQuestion: async () => "Build a better setup flow",
			readStdin: async () => "",
		});
		expect(request).toBe("Build a better setup flow");
	});

	it("rejects empty prompted request", async () => {
		await expect(
			resolveTaskCreateRequest({
				request: undefined,
				askQuestion: async () => "   ",
				readStdin: async () => "",
			}),
		).rejects.toThrow("task create requires a non-empty request");
	});
});

describe("handleCommand resume", () => {
	it("moves issue to assigned and clears only matching run state", async () => {
		const workspaceRoot = await mkdtemp(
			path.join(os.tmpdir(), "adhd-resume-handler-"),
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
			notifications: {
				email: {
					enabled: false,
					resendApiKey: undefined,
					from: undefined,
					to: [],
				},
			},
		};
		await saveRunState(workspaceRoot, createRunState("ROY-215", "planning"));
		await saveRunState(workspaceRoot, createRunState("ROY-999", "planning"));

		const originalFetch = LinearClient.prototype.fetchIssueByIdentifier;
		const originalMarkStage = LinearClient.prototype.markStage;
		const markCalls: Array<{ issueId: string; stage: string }> = [];
		LinearClient.prototype.fetchIssueByIdentifier = async (issueArg) =>
			({
				id: "lin_ROY-215",
				identifier: issueArg,
				title: "Resume test",
				description: "",
				url: "https://linear.app/roy/issue/ROY-215/resume-test",
				state: { id: "state", name: "In Progress" },
				labels: [],
			}) as never;
		LinearClient.prototype.markStage = async (issueId, stage) => {
			markCalls.push({ issueId, stage });
		};

		const writes: string[] = [];
		process.stdout.write = ((chunk: string | Uint8Array) => {
			writes.push(
				typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(),
			);
			return true;
		}) as typeof process.stdout.write;

		try {
			await handleCommand(
				{
					kind: "resume",
					projectId: "default",
					issueKey: "roy-215",
				},
				config,
			);
		} finally {
			LinearClient.prototype.fetchIssueByIdentifier = originalFetch;
			LinearClient.prototype.markStage = originalMarkStage;
		}

		expect(markCalls).toEqual([{ issueId: "lin_ROY-215", stage: "assigned" }]);
		expect(await loadRunState(workspaceRoot, "default", "ROY-215")).toBeNull();
		expect(
			await loadRunState(workspaceRoot, "default", "ROY-999"),
		).not.toBeNull();
		expect(writes.join("")).toContain(
			"Resumed issue and cleared run state for ROY-215 in project default",
		);
	});

	it("clears legacy default run-state fallback for the requested issue", async () => {
		const workspaceRoot = await mkdtemp(
			path.join(os.tmpdir(), "adhd-resume-legacy-handler-"),
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
			notifications: {
				email: {
					enabled: false,
					resendApiKey: undefined,
					from: undefined,
					to: [],
				},
			},
		};
		const legacyTarget = path.join(
			workspaceRoot,
			".piv-loop/runs/ROY-215.json",
		);
		const legacyOther = path.join(workspaceRoot, ".piv-loop/runs/ROY-999.json");
		await mkdir(path.dirname(legacyTarget), { recursive: true });
		await writeFile(legacyTarget, "{}\n", "utf8");
		await writeFile(legacyOther, "{}\n", "utf8");

		const originalFetch = LinearClient.prototype.fetchIssueByIdentifier;
		const originalMarkStage = LinearClient.prototype.markStage;
		LinearClient.prototype.fetchIssueByIdentifier = async (issueArg) =>
			({
				id: "lin_ROY-215",
				identifier: issueArg,
				title: "Resume test",
				description: "",
				url: "https://linear.app/roy/issue/ROY-215/resume-test",
				state: { id: "state", name: "In Progress" },
				labels: [],
			}) as never;
		LinearClient.prototype.markStage = async () => undefined;

		try {
			await handleCommand(
				{
					kind: "resume",
					projectId: "default",
					issueKey: "roy-215",
				},
				config,
			);
		} finally {
			LinearClient.prototype.fetchIssueByIdentifier = originalFetch;
			LinearClient.prototype.markStage = originalMarkStage;
		}

		expect(await loadRunState(workspaceRoot, "default", "ROY-215")).toBeNull();
		expect(
			await loadRunState(workspaceRoot, "default", "ROY-999"),
		).not.toBeNull();
	});

	it("fails when the requested Linear issue does not exist", async () => {
		const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "adhd-resume-"));
		const project = createProject("default", workspaceRoot);
		const config: LoadedConfig = {
			projects: [project],
			polling: {
				intervalMs: 30000,
				maxCycles: 1,
				exitWhenIdle: true,
				staleRunTimeoutMs: 3600000,
			},
			notifications: {
				email: {
					enabled: false,
					resendApiKey: undefined,
					from: undefined,
					to: [],
				},
			},
		};
		const originalFetch = LinearClient.prototype.fetchIssueByIdentifier;
		LinearClient.prototype.fetchIssueByIdentifier = async () => null;
		try {
			await expect(
				handleCommand(
					{
						kind: "resume",
						projectId: "default",
						issueKey: "ROY-404",
					},
					config,
				),
			).rejects.toThrow("Linear issue 'ROY-404' was not found");
		} finally {
			LinearClient.prototype.fetchIssueByIdentifier = originalFetch;
		}
	});
});

describe("printHelp", () => {
	it("includes resume command help", () => {
		const writes: string[] = [];
		process.stdout.write = ((chunk: string | Uint8Array) => {
			writes.push(
				typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(),
			);
			return true;
		}) as typeof process.stdout.write;
		printHelp();
		expect(writes.join("")).toContain(
			"adhd-ai resume --project <PROJECT_ID> --issue <LINEAR_KEY_OR_URL>",
		);
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
				backlog: "Backlog",
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
		server: {
			database: {
				databasePath: "/tmp/workspace/.piv-loop/config/server-db",
			},
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
			githubComment: "/tmp/github-comment.md",
		},
		workflow: {
			issueConcurrency: 1,
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
