import { describe, expect, it } from "bun:test";
import { captureWithRuntime, expectCommanderError } from "./args-test-helpers";

describe("createCliProgram daemon", () => {
	it("runs the production daemon directly", async () => {
		const result = await captureWithRuntime(["bun", "devos", "daemon"]);

		expect(result.calls).toEqual([
			{
				name: "daemonProduction",
				payload: { cwd: "/tmp/devos-test" },
			},
		]);
	});

	it("runs the standalone workflow command worker", async () => {
		const result = await captureWithRuntime([
			"bun",
			"devos",
			"workflow-worker",
		]);

		expect(result.calls).toEqual([
			{
				name: "workflowWorker",
				payload: { cwd: "/tmp/devos-test" },
			},
		]);
	});

	it("runs the standalone worker alias", async () => {
		const result = await captureWithRuntime(["bun", "devos", "worker"]);

		expect(result.calls).toEqual([
			{
				name: "workflowWorker",
				payload: { cwd: "/tmp/devos-test" },
			},
		]);
	});

	it("rejects removed CLI-only daemon flags", async () => {
		const result = await expectCommanderError([
			"bun",
			"devos",
			"daemon",
			"--cli-only",
		]);

		expect(result.error.message).toContain("unknown option '--cli-only'");
		expect(result.stderr).toContain("Usage: devos daemon");
	});
});
