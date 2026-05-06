import { describe, expect, it } from "bun:test";
import { parseArgs } from "../src/args";

describe("parseArgs", () => {
	it("parses run command with issue", () => {
		const parsed = parseArgs(["bun", "piv-loop", "run", "--issue", "ABC-1"]);
		expect(parsed).toEqual({
			kind: "run",
			options: {
				issueArg: "ABC-1",
				projectId: undefined,
				allProjects: false,
				poll: false,
				exitWhenIdle: undefined,
				pollIntervalMs: undefined,
				maxPollCycles: undefined,
			},
		});
	});

	it("parses run with project", () => {
		const parsed = parseArgs(["bun", "piv-loop", "run", "--project", "api"]);
		expect(parsed).toEqual({
			kind: "run",
			options: {
				projectId: "api",
				allProjects: false,
				poll: false,
				exitWhenIdle: undefined,
				pollIntervalMs: undefined,
				maxPollCycles: undefined,
			},
		});
	});

	it("parses run polling flags", () => {
		const parsed = parseArgs([
			"bun",
			"piv-loop",
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
				exitWhenIdle: undefined,
				pollIntervalMs: 15000,
				maxPollCycles: 20,
			},
		});
	});

	it("parses no-exit-when-idle flag", () => {
		const parsed = parseArgs([
			"bun",
			"piv-loop",
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
				exitWhenIdle: false,
				pollIntervalMs: undefined,
				maxPollCycles: undefined,
			},
		});
	});

	it("rejects invalid poll-interval-ms", () => {
		expect(() =>
			parseArgs(["bun", "piv-loop", "run", "--poll-interval-ms", "0"]),
		).toThrow("--poll-interval-ms must be a positive integer");
	});

	it("rejects invalid max-poll-cycles", () => {
		expect(() =>
			parseArgs(["bun", "piv-loop", "run", "--max-poll-cycles", "-1"]),
		).toThrow("--max-poll-cycles must be a positive integer");
	});

	it("parses status command", () => {
		const parsed = parseArgs([
			"bun",
			"piv-loop",
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

	it("rejects project with all-projects", () => {
		expect(() =>
			parseArgs([
				"bun",
				"piv-loop",
				"run",
				"--project",
				"api",
				"--all-projects",
			]),
		).toThrow("run command cannot use --project with --all-projects");
	});
});
