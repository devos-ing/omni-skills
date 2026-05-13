import { describe, expect, it } from "bun:test";
import { parseArgs } from "../src/args";

describe("parseArgs", () => {
	it("parses run command with issue", () => {
		const parsed = parseArgs(["bun", "adhd-ai", "run", "--issue", "ABC-1"]);
		expect(parsed).toEqual({
			kind: "run",
			options: {
				issueArg: "ABC-1",
				projectId: undefined,
				allProjects: false,
				poll: false,
				concurrency: undefined,
				exitWhenIdle: undefined,
				pollIntervalMs: undefined,
				maxPollCycles: undefined,
			},
		});
	});

	it("parses run with project", () => {
		const parsed = parseArgs(["bun", "adhd-ai", "run", "--project", "api"]);
		expect(parsed).toEqual({
			kind: "run",
			options: {
				projectId: "api",
				allProjects: false,
				poll: false,
				concurrency: undefined,
				exitWhenIdle: undefined,
				pollIntervalMs: undefined,
				maxPollCycles: undefined,
			},
		});
	});

	it("parses run polling flags", () => {
		const parsed = parseArgs([
			"bun",
			"adhd-ai",
			"run",
			"--poll",
			"--poll-interval-ms",
			"15000",
			"--max-poll-cycles",
			"20",
		]);
		expect(parsed).toEqual({
			kind: "run",
			options: {
				issueArg: undefined,
				projectId: undefined,
				allProjects: false,
				poll: true,
				concurrency: undefined,
				exitWhenIdle: undefined,
				pollIntervalMs: 15000,
				maxPollCycles: 20,
			},
		});
	});

	it("parses no-exit-when-idle flag", () => {
		const parsed = parseArgs([
			"bun",
			"adhd-ai",
			"run",
			"--poll",
			"--no-exit-when-idle",
		]);
		expect(parsed).toEqual({
			kind: "run",
			options: {
				issueArg: undefined,
				projectId: undefined,
				allProjects: false,
				poll: true,
				concurrency: undefined,
				exitWhenIdle: false,
				pollIntervalMs: undefined,
				maxPollCycles: undefined,
			},
		});
	});

	it("parses run concurrency flag", () => {
		const parsed = parseArgs(["bun", "adhd-ai", "run", "--concurrency", "2"]);
		expect(parsed).toEqual({
			kind: "run",
			options: {
				issueArg: undefined,
				projectId: undefined,
				allProjects: false,
				poll: false,
				concurrency: 2,
				exitWhenIdle: undefined,
				pollIntervalMs: undefined,
				maxPollCycles: undefined,
			},
		});
	});

	it("parses isolated worktrees flag", () => {
		const parsed = parseArgs(["bun", "adhd-ai", "run", "--isolated-worktrees"]);
		expect(parsed).toEqual({
			kind: "run",
			options: {
				issueArg: undefined,
				projectId: undefined,
				allProjects: false,
				poll: false,
				concurrency: undefined,
				exitWhenIdle: undefined,
				pollIntervalMs: undefined,
				maxPollCycles: undefined,
				isolatedWorktrees: true,
			},
		});
	});

	it("rejects invalid poll-interval-ms", () => {
		expect(() =>
			parseArgs(["bun", "adhd-ai", "run", "--poll-interval-ms", "0"]),
		).toThrow("--poll-interval-ms must be a positive integer");
	});

	it("rejects invalid max-poll-cycles", () => {
		expect(() =>
			parseArgs(["bun", "adhd-ai", "run", "--max-poll-cycles", "-1"]),
		).toThrow("--max-poll-cycles must be a positive integer");
	});

	it("rejects invalid concurrency when zero", () => {
		expect(() =>
			parseArgs(["bun", "adhd-ai", "run", "--concurrency", "0"]),
		).toThrow("--concurrency must be a positive integer");
	});

	it("rejects invalid concurrency when negative", () => {
		expect(() =>
			parseArgs(["bun", "adhd-ai", "run", "--concurrency", "-2"]),
		).toThrow("--concurrency must be a positive integer");
	});

	it("rejects invalid concurrency when non-integer", () => {
		expect(() =>
			parseArgs(["bun", "adhd-ai", "run", "--concurrency", "1.5"]),
		).toThrow("--concurrency must be a positive integer");
	});

	it("parses status command", () => {
		const parsed = parseArgs([
			"bun",
			"adhd-ai",
			"status",
			"--project",
			"api",
			"--issue",
			"ABC-1",
		]);
		expect(parsed).toEqual({
			kind: "status",
			issueKey: "ABC-1",
			projectId: "api",
		});
	});

	it("rejects unknown command", () => {
		expect(() => parseArgs(["bun", "adhd-ai", "unknown", "--option"])).toThrow(
			"Unknown command: unknown",
		);
	});

	it("parses setup command", () => {
		expect(parseArgs(["bun", "adhd-ai", "setup"])).toEqual({
			kind: "setup",
			check: false,
		});
	});

	it("parses setup check command", () => {
		expect(parseArgs(["bun", "adhd-ai", "setup", "--check"])).toEqual({
			kind: "setup",
			check: true,
		});
	});

	it("parses skills list command", () => {
		expect(parseArgs(["bun", "adhd-ai", "skills", "list"])).toEqual({
			kind: "skills",
			command: {
				action: "list",
				projectId: undefined,
			},
		});
	});

	it("parses skills add command", () => {
		expect(
			parseArgs([
				"bun",
				"adhd-ai",
				"skills",
				"add",
				"--title",
				"Backend Standard",
				"--description",
				"Rules",
				"--content",
				"Use consistent module boundaries.",
				"--project",
				"api",
			]),
		).toEqual({
			kind: "skills",
			command: {
				action: "add",
				title: "Backend Standard",
				description: "Rules",
				content: "Use consistent module boundaries.",
				projectId: "api",
			},
		});
	});

	it("parses skills update command", () => {
		expect(
			parseArgs([
				"bun",
				"adhd-ai",
				"skills",
				"update",
				"backend-standard",
				"--description",
				"Updated description",
			]),
		).toEqual({
			kind: "skills",
			command: {
				action: "update",
				name: "backend-standard",
				title: undefined,
				description: "Updated description",
				content: undefined,
				projectId: undefined,
			},
		});
	});

	it("parses skills remove command", () => {
		expect(
			parseArgs([
				"bun",
				"adhd-ai",
				"skills",
				"remove",
				"backend-standard",
				"--project",
				"default",
			]),
		).toEqual({
			kind: "skills",
			command: {
				action: "remove",
				name: "backend-standard",
				projectId: "default",
			},
		});
	});

	it("parses task create command", () => {
		expect(
			parseArgs([
				"bun",
				"adhd-ai",
				"task",
				"create",
				"--request",
				"Build a better setup flow",
				"--project",
				"default",
			]),
		).toEqual({
			kind: "task",
			command: {
				action: "create",
				request: "Build a better setup flow",
				projectId: "default",
				answers: undefined,
			},
		});
	});

	it("parses task create stdin request marker", () => {
		expect(
			parseArgs(["bun", "adhd-ai", "task", "create", "--request", "-"]),
		).toEqual({
			kind: "task",
			command: {
				action: "create",
				request: "-",
				projectId: undefined,
				answers: undefined,
			},
		});
	});

	it("parses task create without request", () => {
		expect(parseArgs(["bun", "adhd-ai", "task", "create"])).toEqual({
			kind: "task",
			command: {
				action: "create",
				request: undefined,
				projectId: undefined,
				answers: undefined,
			},
		});
	});

	it("parses task create positional request", () => {
		expect(
			parseArgs([
				"bun",
				"adhd-ai",
				"task",
				"create",
				"Build",
				"a",
				"better",
				"setup",
				"flow",
			]),
		).toEqual({
			kind: "task",
			command: {
				action: "create",
				request: "Build a better setup flow",
				projectId: undefined,
				answers: undefined,
			},
		});
	});

	it("parses task create answers JSON", () => {
		expect(
			parseArgs([
				"bun",
				"adhd-ai",
				"task",
				"create",
				"--request",
				"Create task",
				"--answers-json",
				'[{"question":"Who is this for?","answer":"CLI users"}]',
			]),
		).toEqual({
			kind: "task",
			command: {
				action: "create",
				request: "Create task",
				projectId: undefined,
				answers: [{ question: "Who is this for?", answer: "CLI users" }],
			},
		});
	});

	it("rejects invalid task create answers JSON", () => {
		expect(() =>
			parseArgs([
				"bun",
				"adhd-ai",
				"task",
				"create",
				"--request",
				"Create task",
				"--answers-json",
				"not-json",
			]),
		).toThrow("task create --answers-json must be valid JSON");
	});

	it("rejects skills add without required flags", () => {
		expect(() =>
			parseArgs(["bun", "adhd-ai", "skills", "add", "--title", "t"]),
		).toThrow("skills add requires --description <VALUE>");
	});

	it("rejects skills update without any fields", () => {
		expect(() =>
			parseArgs(["bun", "adhd-ai", "skills", "update", "backend-standard"]),
		).toThrow(
			"skills update requires at least one of --title, --description, or --content",
		);
	});

	it("rejects unknown skills action", () => {
		expect(() => parseArgs(["bun", "adhd-ai", "skills", "ship-it"])).toThrow(
			"Unknown skills action: ship-it",
		);
	});

	it("rejects project with all-projects", () => {
		expect(() =>
			parseArgs([
				"bun",
				"adhd-ai",
				"run",
				"--project",
				"api",
				"--all-projects",
			]),
		).toThrow("run command cannot use --project with --all-projects");
	});
});
