import { describe, expect, it } from "bun:test";
import { captureWithRuntime, expectCommanderError } from "./args-test-helpers";

describe("createCliProgram help and core commands", () => {
	it("prints root help when no command is provided", async () => {
		const result = await expectCommanderError(["bun", "devos"]);

		expect(result.error.exitCode).toBe(0);
		expect(result.stdout).toContain("Usage: devos [options] [command]");
		expect(result.stdout).toContain("run [options]");
		expect(result.stdout).toContain("help [command]");
		expect(result.stderr).toBe("");
	});

	it("prints root help for help flags and command", async () => {
		const flagResult = await expectCommanderError(["bun", "devos", "--help"]);
		const commandResult = await expectCommanderError(["bun", "devos", "help"]);

		expect(flagResult.error.exitCode).toBe(0);
		expect(flagResult.stdout).toContain("Usage: devos [options] [command]");
		expect(commandResult.error.exitCode).toBe(0);
		expect(commandResult.stdout).toContain("Usage: devos [options] [command]");
	});

	it("prints subcommand help", async () => {
		const result = await expectCommanderError([
			"bun",
			"devos",
			"run",
			"--help",
		]);

		expect(result.error.exitCode).toBe(0);
		expect(result.stdout).toContain("Usage: devos run [options]");
		expect(result.stdout).toContain("--poll-forever");
	});

	it("runs status command with loaded config", async () => {
		const result = await captureWithRuntime([
			"bun",
			"devos",
			"status",
			"--project",
			"api",
			"--issue",
			"ABC-1",
		]);

		expect(result.calls).toEqual([
			{ name: "loadConfig" },
			{ name: "status", payload: { issueKey: "ABC-1", projectId: "api" } },
		]);
	});

	it("rejects status without required project", async () => {
		const result = await expectCommanderError([
			"bun",
			"devos",
			"status",
			"--issue",
			"ABC-1",
		]);

		expect(result.error.message).toBe(
			"error: required option '--project <PROJECT_ID>' not specified",
		);
		expect(result.stderr).toContain("Usage: devos status [options]");
	});

	it("runs production daemon command", async () => {
		const result = await captureWithRuntime(["bun", "devos", "daemon"]);

		expect(result.calls).toEqual([
			{ name: "daemonProduction", payload: { cwd: "/tmp/devos-test" } },
		]);
	});

	it("runs onboard commands without loading config", async () => {
		expect(
			(await captureWithRuntime(["bun", "devos", "onboard"])).calls,
		).toEqual([
			{
				name: "onboard",
				payload: { command: { check: false }, cwd: "/tmp/devos-test" },
			},
		]);
		expect(
			(await captureWithRuntime(["bun", "devos", "onboard", "--check"])).calls,
		).toEqual([
			{
				name: "onboard",
				payload: { command: { check: true }, cwd: "/tmp/devos-test" },
			},
		]);
	});

	it("routes model setting commands without loading project config", async () => {
		const result = await captureWithRuntime([
			"bun",
			"devos",
			"models",
			"set",
			"--stage",
			"plan",
			"--model",
			"gpt-5.5",
			"--reasoning-effort",
			"high",
		]);

		expect(result.calls).toEqual([
			{
				name: "models",
				payload: {
					command: {
						action: "set",
						stage: "plan",
						model: "gpt-5.5",
						reasoningEffort: "high",
					},
					cwd: "/tmp/devos-test",
				},
			},
		]);
	});

	it("routes brainstorm model setting commands", async () => {
		const result = await captureWithRuntime([
			"bun",
			"devos",
			"models",
			"set",
			"--stage",
			"brainstorm",
			"--model",
			"gpt-5.4-mini",
			"--reasoning-effort",
			"xhigh",
		]);

		expect(result.calls).toEqual([
			{
				name: "models",
				payload: {
					command: {
						action: "set",
						stage: "brainstorm",
						model: "gpt-5.4-mini",
						reasoningEffort: "xhigh",
					},
					cwd: "/tmp/devos-test",
				},
			},
		]);
	});

	it("rejects unknown commands", async () => {
		const unknown = await expectCommanderError([
			"bun",
			"devos",
			"unknown",
			"--option",
		]);
		const legacySetup = await expectCommanderError(["bun", "devos", "setup"]);
		const projects = await expectCommanderError(["bun", "devos", "projects"]);

		expect(unknown.error.message).toBe("error: unknown command 'unknown'");
		expect(unknown.stderr).toContain("Usage: devos [options] [command]");
		expect(legacySetup.error.message).toContain(
			"error: unknown command 'setup'",
		);
		expect(projects.error.message).toContain(
			"error: unknown command 'projects'",
		);
	});
});
