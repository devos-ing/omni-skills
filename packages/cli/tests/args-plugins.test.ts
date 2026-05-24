import { describe, expect, it } from "bun:test";
import { captureWithRuntime, expectCommanderError } from "./args-test-helpers";

describe("createCliProgram plugins", () => {
	it("runs plugins create command", async () => {
		expect(
			(
				await captureWithRuntime([
					"bun",
					"devos",
					"plugins",
					"create",
					"slack",
					"--preset",
					"slack",
					"--output",
					"/tmp/plugins",
					"--json",
				])
			).calls,
		).toEqual([
			{ name: "loadConfig" },
			{
				name: "plugins",
				payload: {
					action: "create",
					name: "slack",
					preset: "slack",
					outputDir: "/tmp/plugins",
					template: undefined,
					displayName: undefined,
					description: undefined,
					author: undefined,
					force: undefined,
					json: true,
					cwd: "/tmp/devos-test",
				},
			},
		]);
	});

	it("runs plugins list command", async () => {
		expect(
			(await captureWithRuntime(["bun", "devos", "plugins", "list"])).calls,
		).toEqual([
			{ name: "loadConfig" },
			{
				name: "plugins",
				payload: {
					action: "list",
					enabledOnly: undefined,
					cwd: "/tmp/devos-test",
				},
			},
		]);
	});

	it("runs plugins list enabled command", async () => {
		expect(
			(
				await captureWithRuntime([
					"bun",
					"devos",
					"plugins",
					"list",
					"--enabled",
				])
			).calls,
		).toEqual([
			{ name: "loadConfig" },
			{
				name: "plugins",
				payload: {
					action: "list",
					enabledOnly: true,
					cwd: "/tmp/devos-test",
				},
			},
		]);
	});

	it("runs plugin detail commands", async () => {
		for (const action of ["show", "install", "enable", "check"] as const) {
			const result = await captureWithRuntime([
				"bun",
				"devos",
				"plugins",
				action,
				"rtk-token-optimizer",
			]);
			expect(result.calls).toEqual([
				{ name: "loadConfig" },
				{
					name: "plugins",
					payload: {
						action,
						pluginId: "rtk-token-optimizer",
						cwd: "/tmp/devos-test",
					},
				},
			]);
		}
	});

	it("rejects unknown plugins action", async () => {
		const result = await expectCommanderError([
			"bun",
			"devos",
			"plugins",
			"ship-it",
		]);

		expect(result.error.message).toBe("error: unknown command 'ship-it'");
		expect(result.stderr).toContain("Usage: devos plugins [options] [command]");
	});
});
