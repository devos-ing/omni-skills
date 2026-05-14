import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseTaskIntakeDecision } from "../src/features/task-intake/parser";
import { buildTaskIntakePrompt } from "../src/features/task-intake/prompts";
import { runTaskIntake } from "../src/features/task-intake/run";
import type { ResolvedProjectConfig } from "../src/features/types";

describe("parseTaskIntakeDecision", () => {
	it("parses clear task output", () => {
		expect(
			parseTaskIntakeDecision(
				[
					"RESULT: CLEAR",
					'TASK_JSON: {"title":"Improve setup","description":"Make setup clearer."}',
					"QUESTIONS_JSON: []",
				].join("\n"),
			),
		).toEqual({
			result: "CLEAR",
			task: {
				title: "Improve setup",
				description: "Make setup clearer.",
			},
		});
	});

	it("parses needs-info questions", () => {
		expect(
			parseTaskIntakeDecision(
				[
					"RESULT: NEEDS_INFO",
					"TASK_JSON: {}",
					'QUESTIONS_JSON: ["Which workflow should change?"]',
				].join("\n"),
			),
		).toEqual({
			result: "NEEDS_INFO",
			questions: ["Which workflow should change?"],
		});
	});

	it("rejects malformed task json", () => {
		expect(() =>
			parseTaskIntakeDecision(
				"RESULT: CLEAR\nTASK_JSON: { nope }\nQUESTIONS_JSON: []",
			),
		).toThrow("Failed to parse TASK_JSON");
	});

	it("rejects empty questions", () => {
		expect(() =>
			parseTaskIntakeDecision(
				"RESULT: NEEDS_INFO\nTASK_JSON: {}\nQUESTIONS_JSON: []",
			),
		).toThrow("QUESTIONS_JSON must include at least one question");
	});

	it("rejects empty task title or description", () => {
		expect(() =>
			parseTaskIntakeDecision(
				'RESULT: CLEAR\nTASK_JSON: {"title":"","description":"Body"}',
			),
		).toThrow("TASK_JSON.title must be a non-empty string");
		expect(() =>
			parseTaskIntakeDecision(
				'RESULT: CLEAR\nTASK_JSON: {"title":"Title","description":""}',
			),
		).toThrow("TASK_JSON.description must be a non-empty string");
	});
});

describe("buildTaskIntakePrompt", () => {
	it("includes skill text, request, and clarification answers", async () => {
		const tmpDir = await mkdtemp(path.join(os.tmpdir(), "adhd-task-skill-"));
		const skillPath = path.join(tmpDir, "SKILL.md");
		await writeFile(skillPath, "Ask precise questions.", "utf8");
		try {
			const prompt = await buildTaskIntakePrompt(skillPath, "Create a task", [
				{ question: "Which app?", answer: "CLI" },
			]);
			expect(prompt).toContain("Ask precise questions.");
			expect(prompt).toContain("Original request:\nCreate a task");
			expect(prompt).toContain("Q: Which app?");
			expect(prompt).toContain("A: CLI");
			expect(prompt).toContain("RESULT: CLEAR or NEEDS_INFO");
		} finally {
			await rm(tmpDir, { recursive: true, force: true });
		}
	});
});

describe("runTaskIntake", () => {
	it("creates a backlog task when the first agent pass is clear", async () => {
		const created: string[] = [];
		const result = await runTaskIntake(
			project(),
			agent([
				'RESULT: CLEAR\nTASK_JSON: {"title":"Add task CLI","description":"Create Linear tasks from CLI."}',
			]),
			{
				createBacklogTask: async (input) => {
					created.push(input.title);
					return {
						id: "lin_1",
						identifier: "ROY-1",
						title: input.title,
						url: "https://linear.example/ROY-1",
					};
				},
			},
			{ request: "task cli", askQuestion: async () => "" },
		);
		expect(result.status).toBe("created");
		expect(created).toEqual(["Add task CLI"]);
	});

	it("asks clarifying questions until requirements are clear", async () => {
		const prompts: string[] = [];
		const answers: string[] = ["CLI users"];
		const result = await runTaskIntake(
			project(),
			agent(
				[
					'RESULT: NEEDS_INFO\nQUESTIONS_JSON: ["Who is this for?"]',
					'RESULT: CLEAR\nTASK_JSON: {"title":"Add task CLI","description":"Create tasks for CLI users."}',
				],
				prompts,
			),
			{
				createBacklogTask: async (input) => ({
					id: "lin_2",
					identifier: "ROY-2",
					title: input.title,
					url: "https://linear.example/ROY-2",
				}),
			},
			{
				request: "create task",
				askQuestion: async () => answers.shift() ?? "",
			},
		);
		expect(result.status).toBe("created");
		expect(prompts[1]).toContain("Q: Who is this for?");
		expect(prompts[1]).toContain("A: CLI users");
	});

	it("uses provided clarification answers in non-interactive mode", async () => {
		const prompts: string[] = [];
		const result = await runTaskIntake(
			project(),
			agent(
				[
					'RESULT: NEEDS_INFO\nQUESTIONS_JSON: ["Who is this for?"]',
					'RESULT: CLEAR\nTASK_JSON: {"title":"Add task CLI","description":"Create tasks for CLI users."}',
				],
				prompts,
			),
			{
				createBacklogTask: async (input) => ({
					id: "lin_3",
					identifier: "ROY-3",
					title: input.title,
					url: "https://linear.example/ROY-3",
				}),
			},
			{
				request: "create task",
				providedAnswers: [
					{ question: "Who is this for?", answer: "CLI users" },
				],
				nonInteractive: true,
				askQuestion: async () => {
					throw new Error("should not ask interactive questions");
				},
			},
		);
		expect(result.status).toBe("created");
		expect(prompts[1]).toContain("Q: Who is this for?");
		expect(prompts[1]).toContain("A: CLI users");
	});

	it("returns needs_info when non-interactive mode lacks answers", async () => {
		const result = await runTaskIntake(
			project(),
			agent(['RESULT: NEEDS_INFO\nQUESTIONS_JSON: ["Who is this for?"]']),
			{
				createBacklogTask: async () => {
					throw new Error("should not create");
				},
			},
			{
				request: "create task",
				nonInteractive: true,
				askQuestion: async () => {
					throw new Error("should not ask interactive questions");
				},
			},
		);
		expect(result).toEqual({
			status: "needs_info",
			questions: ["Who is this for?"],
		});
	});

	it("exits without creating after max clarification rounds", async () => {
		let created = false;
		const result = await runTaskIntake(
			project(),
			agent([
				'RESULT: NEEDS_INFO\nQUESTIONS_JSON: ["Which project?"]',
				'RESULT: NEEDS_INFO\nQUESTIONS_JSON: ["Which workflow?"]',
			]),
			{
				createBacklogTask: async () => {
					created = true;
					throw new Error("should not create");
				},
			},
			{
				request: "make it better",
				maxClarificationRounds: 1,
				askQuestion: async () => "answer",
			},
		);
		expect(result).toEqual({
			status: "needs_info",
			questions: ["Which workflow?"],
		});
		expect(created).toBe(false);
	});

	it("returns needs_info immediately in non-interactive mode", async () => {
		let questionAsked = false;
		const prompts: string[] = [];
		const result = await runTaskIntake(
			project(),
			agent(
				['RESULT: NEEDS_INFO\nQUESTIONS_JSON: ["Which project?"]'],
				prompts,
			),
			{
				createBacklogTask: async () => {
					throw new Error("should not create");
				},
			},
			{
				request: "create task",
				initialAnswers: [{ question: "Who?", answer: "CLI users" }],
				allowInteractiveQuestions: false,
				askQuestion: async () => {
					questionAsked = true;
					return "answer";
				},
			},
		);
		expect(result).toEqual({
			status: "needs_info",
			questions: ["Which project?"],
		});
		expect(questionAsked).toBe(false);
		expect(prompts[0]).toContain("Q: Who?");
		expect(prompts[0]).toContain("A: CLI users");
	});
});

function agent(messages: string[], prompts: string[] = []) {
	return {
		runTaskIntake: async (prompt: string) => {
			prompts.push(prompt);
			return { finalMessage: messages.shift() ?? "", stdout: "" };
		},
	};
}

function project(): ResolvedProjectConfig {
	return {
		id: "default",
		name: "default",
		workspacePath: "/tmp/work",
		executionPath: "/tmp/work",
		repo: { owner: "acme", name: "repo", baseBranch: "main" },
		linear: {
			apiKey: "key",
			apiUrl: "https://linear.example/graphql",
			projectId: "proj",
			teamId: "team",
			pollLimit: 10,
			statusMap: {
				backlog: "backlog",
				assigned: "assigned",
				planning: "planning",
				implementing: "implementing",
				pr_created: "pr_created",
				reviewing: "reviewing",
				testing: "testing",
				blocked: "blocked",
				done: "done",
			},
			labelMap: {},
			autoCreateLabels: false,
		},
		github: { useGhCli: false, defaultBugLabel: "bug" },
		server: { database: { databasePath: "/tmp/adhdai.sqlite" } },
		codex: { binary: "codex", streamLogs: false },
		agent: { backend: "codex" },
		workflow: { issueConcurrency: 1 },
		skills: {
			root: "skills",
			plan: "skills/piv-plan/SKILL.md",
			implement: "skills/piv-implement/SKILL.md",
			reviewTest: "skills/piv-review-test/SKILL.md",
			githubComment: "skills/piv-github-comment/SKILL.md",
			createTask: "skills/adhd-explore/SKILL.md",
		},
		dryRun: false,
	};
}
