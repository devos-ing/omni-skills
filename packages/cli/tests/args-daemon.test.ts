import { describe, expect, it } from "bun:test";
import { captureWithRuntime, expectCommanderError } from "./args-test-helpers";

describe("createCliProgram daemon", () => {
	it("runs daemon cli-only command", async () => {
		const result = await captureWithRuntime([
			"bun",
			"devos",
			"daemon",
			"--cli-only",
		]);

		expect(result.calls).toEqual([
			{
				name: "daemonCliOnly",
				payload: { cwd: "/tmp/devos-test" },
			},
		]);
	});

	it("runs daemon cli-only polling command", async () => {
		const result = await captureWithRuntime([
			"bun",
			"devos",
			"daemon",
			"--cli-only",
			"--poll-forever",
			"--all-projects",
		]);

		expect(result.calls).toEqual([
			{
				name: "daemonCliOnly",
				payload: {
					cwd: "/tmp/devos-test",
					pollForever: true,
					allProjects: true,
				},
			},
		]);
	});

	it("rejects daemon polling flags without cli-only", async () => {
		const result = await expectCommanderError([
			"bun",
			"devos",
			"daemon",
			"--poll-forever",
		]);

		expect(result.error.message).toContain(
			"daemon polling flags require --cli-only",
		);
		expect(result.stderr).toContain("Usage: devos daemon [options]");
	});

	it("rejects all-projects without poll-forever", async () => {
		const result = await expectCommanderError([
			"bun",
			"devos",
			"daemon",
			"--cli-only",
			"--all-projects",
		]);

		expect(result.error.message).toBe(
			"daemon --all-projects requires --poll-forever",
		);
		expect(result.stderr).toContain("Usage: devos daemon [options]");
	});
});
