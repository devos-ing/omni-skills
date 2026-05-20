import { describe, expect, it } from "bun:test";
import { captureWithRuntime, expectCommanderError } from "./args-test-helpers";

describe("createCliProgram task create", () => {
	it("runs explicit and stdin request markers", async () => {
		expect(
			(
				await captureWithRuntime([
					"bun",
					"devos",
					"task",
					"create",
					"--request",
					"Build a better setup flow",
					"--project",
					"default",
				])
			).calls,
		).toEqual([
			{ name: "loadConfig" },
			{
				name: "task",
				payload: {
					action: "create",
					request: "Build a better setup flow",
					projectId: "default",
					nonInteractive: undefined,
					maxClarificationRounds: undefined,
					clarificationAnswers: undefined,
					json: undefined,
				},
			},
		]);
		expect(
			(
				await captureWithRuntime([
					"bun",
					"devos",
					"task",
					"create",
					"--request",
					"-",
				])
			).calls,
		).toEqual([
			{ name: "loadConfig" },
			{
				name: "task",
				payload: {
					action: "create",
					request: "-",
					projectId: undefined,
					nonInteractive: undefined,
					maxClarificationRounds: undefined,
					clarificationAnswers: undefined,
					json: undefined,
				},
			},
		]);
	});

	it("runs missing and positional request text", async () => {
		expect(
			(await captureWithRuntime(["bun", "devos", "task", "create"])).calls,
		).toEqual([
			{ name: "loadConfig" },
			{
				name: "task",
				payload: {
					action: "create",
					request: undefined,
					projectId: undefined,
					nonInteractive: undefined,
					maxClarificationRounds: undefined,
					clarificationAnswers: undefined,
					json: undefined,
				},
			},
		]);
		expect(
			(
				await captureWithRuntime([
					"bun",
					"devos",
					"task",
					"create",
					"Build",
					"a",
					"better",
					"setup",
					"flow",
				])
			).calls,
		).toEqual([
			{ name: "loadConfig" },
			{
				name: "task",
				payload: {
					action: "create",
					request: "Build a better setup flow",
					projectId: undefined,
					nonInteractive: undefined,
					maxClarificationRounds: undefined,
					clarificationAnswers: undefined,
					json: undefined,
				},
			},
		]);
	});

	it("runs non-interactive task create flags", async () => {
		expect(
			(
				await captureWithRuntime([
					"bun",
					"devos",
					"task",
					"create",
					"--request",
					"Build task flow",
					"--non-interactive",
					"--max-clarification-rounds",
					"2",
					"--clarifications-json",
					'[{"question":"Who?","answer":"CLI users"}]',
				])
			).calls,
		).toEqual([
			{ name: "loadConfig" },
			{
				name: "task",
				payload: {
					action: "create",
					request: "Build task flow",
					projectId: undefined,
					nonInteractive: true,
					maxClarificationRounds: 2,
					clarificationAnswers: [{ question: "Who?", answer: "CLI users" }],
					json: undefined,
				},
			},
		]);
	});

	it("rejects invalid task create clarifications json", async () => {
		const result = await expectCommanderError([
			"bun",
			"devos",
			"task",
			"create",
			"--request",
			"Build task flow",
			"--clarifications-json",
			"{bad",
		]);

		expect(result.error.message).toContain("must be valid JSON");
		expect(result.stderr).toContain("Usage: devos task create [options]");
	});
});
