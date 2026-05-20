import { describe, expect, it } from "bun:test";
import { captureWithRuntime, expectCommanderError } from "./args-test-helpers";

describe("createCliProgram skills", () => {
	it("runs skills list command", async () => {
		expect(
			(await captureWithRuntime(["bun", "devos", "skills", "list"])).calls,
		).toEqual([
			{ name: "loadConfig" },
			{
				name: "skills",
				payload: {
					action: "list",
					projectId: undefined,
				},
			},
		]);
	});

	it("runs skills add command", async () => {
		expect(
			(
				await captureWithRuntime([
					"bun",
					"devos",
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
				])
			).calls,
		).toEqual([
			{ name: "loadConfig" },
			{
				name: "skills",
				payload: {
					action: "add",
					title: "Backend Standard",
					description: "Rules",
					content: "Use consistent module boundaries.",
					projectId: "api",
				},
			},
		]);
	});

	it("runs skills update command", async () => {
		expect(
			(
				await captureWithRuntime([
					"bun",
					"devos",
					"skills",
					"update",
					"backend-standard",
					"--description",
					"Updated description",
				])
			).calls,
		).toEqual([
			{ name: "loadConfig" },
			{
				name: "skills",
				payload: {
					action: "update",
					name: "backend-standard",
					title: undefined,
					description: "Updated description",
					content: undefined,
					projectId: undefined,
				},
			},
		]);
	});

	it("runs skills remove command", async () => {
		expect(
			(
				await captureWithRuntime([
					"bun",
					"devos",
					"skills",
					"remove",
					"backend-standard",
					"--project",
					"default",
				])
			).calls,
		).toEqual([
			{ name: "loadConfig" },
			{
				name: "skills",
				payload: {
					action: "remove",
					name: "backend-standard",
					projectId: "default",
				},
			},
		]);
	});

	it("rejects skills add without required flags", async () => {
		const result = await expectCommanderError([
			"bun",
			"devos",
			"skills",
			"add",
			"--title",
			"t",
		]);

		expect(result.error.message).toBe(
			"error: required option '--description <TEXT>' not specified",
		);
	});

	it("rejects skills update without any fields", async () => {
		const result = await expectCommanderError([
			"bun",
			"devos",
			"skills",
			"update",
			"backend-standard",
		]);

		expect(result.error.message).toBe(
			"skills update requires at least one of --title, --description, or --content",
		);
	});

	it("rejects unknown skills action", async () => {
		const result = await expectCommanderError([
			"bun",
			"devos",
			"skills",
			"ship-it",
		]);

		expect(result.error.message).toBe("error: unknown command 'ship-it'");
		expect(result.stderr).toContain("Usage: devos skills [options] [command]");
	});
});
