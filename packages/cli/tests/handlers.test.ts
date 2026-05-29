import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	handleStatusCommand,
	resolveTaskCreateRequest,
} from "../src/features/commands";
import type { LoadedConfig } from "../src/features/config";
import type { ResolvedProjectConfig, RunState } from "../src/features/types";
import { saveRunState } from "../src/features/workflow/state";

const originalStdoutWrite = process.stdout.write.bind(process.stdout);

afterEach(() => {
	process.stdout.write = originalStdoutWrite;
});

describe("handleStatusCommand status output", () => {
	it("includes stageDisplay while preserving stage", async () => {
		const workspaceRoot = await mkdtemp(
			path.join(os.tmpdir(), "adhd-handlers-"),
		);
		const project = createProject("default", workspaceRoot);
		const config: LoadedConfig = {
			projects: [project],
			server: project.server,
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
			workspace: { id: "owner-1", name: "Default Workspace" },
		};

		await saveRunState(workspaceRoot, createRunState("ROY-64", "planning"));

		const writes: string[] = [];
		process.stdout.write = ((chunk: string | Uint8Array) => {
			writes.push(
				typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(),
			);
			return true;
		}) as typeof process.stdout.write;

		await handleStatusCommand(config, {
			projectId: "default",
			issueKey: "roy-64",
		});

		const parsed = JSON.parse(writes.join("")) as {
			stage: string;
			stageDisplay?: string;
		};
		expect(parsed.stage).toBe("plan");
		expect(parsed.stageDisplay).toBe("plan 🧭");
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
		github: {
			useGhCli: true,
			defaultBugLabel: "bug",
		},
		server: {
			database: {
				databasePath: "/tmp/workspace/.devos/config/server-db",
				port: 54329,
			},
		},
		codex: {
			binary: "codex",
			streamLogs: false,
		},
		skills: {
			root: "/tmp/skills",
			brainstorm: "/tmp/brainstorm.md",
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

function createRunState(
	issueKey: string,
	stage: RunState["stage"] | string,
): RunState {
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
		stage: stage as RunState["stage"],
		bugs: [],
		startedAt: now,
		updatedAt: now,
	};
}
