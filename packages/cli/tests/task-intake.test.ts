import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { withQuestionReader } from "../src/features/task-intake/io";
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
			questions: [{ question: "Which workflow should change?" }],
		});
	});

	it("parses needs-info questions with options", () => {
		expect(
			parseTaskIntakeDecision(
				[
					"RESULT: NEEDS_INFO",
					`QUESTIONS_JSON: [{"question":"Which agent?","options":[{"label":"Codex","value":"codex","recommended":true},{"label":"Claude","value":"claude","description":"Use Claude Code"}]}]`,
				].join("\n"),
			),
		).toEqual({
			result: "NEEDS_INFO",
			questions: [
				{
					question: "Which agent?",
					options: [
						{ label: "Codex", value: "codex", recommended: true },
						{
							label: "Claude",
							value: "claude",
							description: "Use Claude Code",
						},
					],
				},
			],
		});
	});

	it("rejects malformed recommended option values", () => {
		expect(() =>
			parseTaskIntakeDecision(
				[
					"RESULT: NEEDS_INFO",
					`QUESTIONS_JSON: [{"question":"Which agent?","options":[{"label":"Codex","value":"codex","recommended":"yes"},{"label":"Claude","value":"claude"}]}]`,
				].join("\n"),
			),
		).toThrow("recommended must be a boolean");
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
			expect(prompt).toContain("return exactly one concise question");
			expect(prompt).toContain("optional options array");
			expect(prompt).toContain("mark exactly one best option");
			expect(prompt).toContain('"recommended":true');
			expect(prompt).toContain("custom free-form answer");
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
				createTask: async (input) => {
					created.push(input.title);
					return createdTask("task-1", "DEF-1", input.title);
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
				createTask: async (input) =>
					createdTask("task-2", "DEF-2", input.title),
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
				createTask: async (input) =>
					createdTask("task-3", "DEF-3", input.title),
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
				createTask: async () => {
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
			questions: [{ question: "Who is this for?" }],
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
				createTask: async () => {
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
			questions: [{ question: "Which workflow?" }],
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
				createTask: async () => {
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
			questions: [{ question: "Which project?" }],
		});
		expect(questionAsked).toBe(false);
		expect(prompts[0]).toContain("Q: Who?");
		expect(prompts[0]).toContain("A: CLI users");
	});
});

describe("withQuestionReader", () => {
	it("routes interactive task questions through the prompt adapter", async () => {
		const asked: string[] = [];
		const result = await withQuestionReader(
			async (askQuestion) => askQuestion("Who is this for?"),
			{
				text: async ({ message }) => {
					asked.push(message);
					return "CLI users";
				},
				password: async () => "",
				confirm: async () => false,
				select: async (options) => options.options[0]?.value ?? "",
			},
		);

		expect(asked).toEqual(["Who is this for?"]);
		expect(result).toBe("CLI users");
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

function createdTask(id: string, taskKey: string, title: string) {
	return {
		id,
		taskKey,
		projectId: "default",
		title,
		content: "Task content",
		priority: 1,
		status: "planning",
		dueDate: null,
		creatorId: "member-1",
		linkedPr: null,
		externalIssueId: null,
		externalIdentifier: null,
		externalUrl: null,
		createdAt: "2026-05-15T00:00:00.000Z",
		updatedAt: "2026-05-15T00:00:00.000Z",
	};
}

function project(): ResolvedProjectConfig {
	return {
		id: "default",
		name: "default",
		workspacePath: "/tmp/work",
		executionPath: "/tmp/work",
		repo: { owner: "acme", name: "repo", baseBranch: "main" },
		github: { useGhCli: false, defaultBugLabel: "bug" },
		server: { database: { databasePath: "/tmp/devos.sqlite", port: 54329 } },
		codex: { binary: "codex", streamLogs: false },
		agent: { backend: "codex" },
		workflow: { issueConcurrency: 1 },
		skills: {
			root: "skills",
			brainstorm: "skills/piv-brainstorm/SKILL.md",
			plan: "skills/piv-plan/SKILL.md",
			implement: "skills/piv-implement/SKILL.md",
			reviewTest: "skills/piv-review-test/SKILL.md",
			githubComment: "skills/piv-github-comment/SKILL.md",
			createTask: "skills/adhd-explore/SKILL.md",
		},
		dryRun: false,
	};
}
