import { describe, expect, it } from "bun:test";
import { CliCommandExecutor } from "../src/features/server/cli-command-executor";
import type { RunCommandFn } from "../src/features/server/cli-command-executor.types";

describe("CliCommandExecutor", () => {
	it("executes allowed run action with structured argv", async () => {
		const calls: Array<{ command: string; args: string[] }> = [];
		const runCommandFn: RunCommandFn = async (command, args) => {
			calls.push({ command, args });
			return { code: 0, stdout: "ok", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({
			action: "run",
			projectId: "default",
			issueKey: "ROY-122",
			poll: true,
			concurrency: 2,
		});

		expect(result.status).toBe("succeeded");
		expect(calls).toEqual([
			{
				command: "bun",
				args: [
					"run",
					"./packages/cli/src/index.ts",
					"run",
					"--project",
					"default",
					"--issue",
					"ROY-122",
					"--poll",
					"--concurrency",
					"2",
				],
			},
		]);
		const history = executor.getHistory();
		expect(history).toHaveLength(1);
		expect(history[0]?.status).toBe("succeeded");
		expect(history[0]?.command).toBe("bun");
	});

	it("rejects unsupported actions without execution", async () => {
		let callCount = 0;
		const runCommandFn: RunCommandFn = async () => {
			callCount += 1;
			return { code: 0, stdout: "", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({ action: "dangerous-shell" });

		expect(result.status).toBe("rejected");
		expect(result.error).toContain("Unsupported CLI action");
		expect(callCount).toBe(0);
		const history = executor.getHistory();
		expect(history).toHaveLength(1);
		expect(history[0]?.status).toBe("rejected");
	});

	it("rejects unknown action without execution", async () => {
		let callCount = 0;
		const runCommandFn: RunCommandFn = async () => {
			callCount += 1;
			return { code: 0, stdout: "", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({
			action: "unknown-action",
		} as unknown as { action: string });

		expect(result.status).toBe("rejected");
		expect(result.error).toContain("Unsupported CLI action");
		expect(callCount).toBe(0);
	});

	it("rejects malformed status action without execution", async () => {
		let callCount = 0;
		const runCommandFn: RunCommandFn = async () => {
			callCount += 1;
			return { code: 0, stdout: "", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const missingProject = await executor.execute({
			action: "status",
			issueKey: "ROY-122",
		} as unknown as { action: string });
		const missingIssue = await executor.execute({
			action: "status",
			projectId: "default",
		} as unknown as { action: string });

		expect(missingProject.status).toBe("rejected");
		expect(missingProject.error).toContain("projectId is required");
		expect(missingIssue.status).toBe("rejected");
		expect(missingIssue.error).toContain("issueKey is required");
		expect(callCount).toBe(0);
		const history = executor.getHistory();
		expect(history).toHaveLength(2);
		expect(history[0]?.status).toBe("rejected");
		expect(history[1]?.status).toBe("rejected");
	});

	it("records failed status and stderr for non-zero exits", async () => {
		const runCommandFn: RunCommandFn = async () => ({
			code: 1,
			stdout: "",
			stderr: "boom",
		});
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({
			action: "status",
			projectId: "default",
			issueKey: "ROY-122",
		});

		expect(result.status).toBe("failed");
		expect(result.commandResult?.code).toBe(1);
		const history = executor.getHistory();
		expect(history).toHaveLength(1);
		expect(history[0]?.status).toBe("failed");
		expect(history[0]?.stderr).toBe("boom");
		expect(history[0]?.error).toBe("boom");
	});

	it("records spawn errors as failed results", async () => {
		const runCommandFn: RunCommandFn = async () => {
			throw new Error("spawn EACCES");
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({ action: "projects" });

		expect(result.status).toBe("failed");
		expect(result.error).toBe("spawn EACCES");
		const history = executor.getHistory();
		expect(history).toHaveLength(1);
		expect(history[0]?.status).toBe("failed");
		expect(history[0]?.error).toBe("spawn EACCES");
	});

	it("executes setup action with structured argv", async () => {
		const calls: Array<{ command: string; args: string[] }> = [];
		const runCommandFn: RunCommandFn = async (command, args) => {
			calls.push({ command, args });
			return { code: 0, stdout: "ok", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({
			action: "setup",
			check: true,
		});

		expect(result.status).toBe("succeeded");
		expect(calls).toEqual([
			{
				command: "bun",
				args: ["run", "./packages/cli/src/index.ts", "setup", "--check"],
			},
		]);
	});

	it("rejects malformed setup requests without execution", async () => {
		let callCount = 0;
		const runCommandFn: RunCommandFn = async () => {
			callCount += 1;
			return { code: 0, stdout: "", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const malformedSetupCheck = await executor.execute({
			action: "setup",
			check: "false",
		} as unknown as { action: string });

		expect(malformedSetupCheck.status).toBe("rejected");
		expect(malformedSetupCheck.error).toContain("check must be a boolean");
		expect(callCount).toBe(0);
	});

	it("executes task create action with structured argv", async () => {
		const calls: Array<{ command: string; args: string[] }> = [];
		const runCommandFn: RunCommandFn = async (command, args) => {
			calls.push({ command, args });
			return { code: 0, stdout: "ok", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({
			action: "task",
			taskAction: "create",
			request: "Build a better setup flow",
			projectId: "default",
		});

		expect(result.status).toBe("succeeded");
		expect(calls).toEqual([
			{
				command: "bun",
				args: [
					"run",
					"./packages/cli/src/index.ts",
					"task",
					"create",
					"--request",
					"Build a better setup flow",
					"--project",
					"default",
				],
			},
		]);
	});

	it("executes skills list action with structured argv", async () => {
		const calls: Array<{ command: string; args: string[] }> = [];
		const runCommandFn: RunCommandFn = async (command, args) => {
			calls.push({ command, args });
			return { code: 0, stdout: "ok", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({
			action: "skills",
			skillsAction: "list",
			projectId: "api",
		});

		expect(result.status).toBe("succeeded");
		expect(calls).toEqual([
			{
				command: "bun",
				args: [
					"run",
					"./packages/cli/src/index.ts",
					"skills",
					"list",
					"--project",
					"api",
				],
			},
		]);
	});

	it("executes skills add action with structured argv", async () => {
		const calls: Array<{ command: string; args: string[] }> = [];
		const runCommandFn: RunCommandFn = async (command, args) => {
			calls.push({ command, args });
			return { code: 0, stdout: "ok", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({
			action: "skills",
			skillsAction: "add",
			title: "Backend Standard",
			description: "Rules",
			content: "Use consistent module boundaries.",
			projectId: "api",
		});

		expect(result.status).toBe("succeeded");
		expect(calls).toEqual([
			{
				command: "bun",
				args: [
					"run",
					"./packages/cli/src/index.ts",
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
				],
			},
		]);
	});

	it("executes skills update action with structured argv", async () => {
		const calls: Array<{ command: string; args: string[] }> = [];
		const runCommandFn: RunCommandFn = async (command, args) => {
			calls.push({ command, args });
			return { code: 0, stdout: "ok", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({
			action: "skills",
			skillsAction: "update",
			name: "backend-standard",
			description: "Updated description",
		});

		expect(result.status).toBe("succeeded");
		expect(calls).toEqual([
			{
				command: "bun",
				args: [
					"run",
					"./packages/cli/src/index.ts",
					"skills",
					"update",
					"backend-standard",
					"--description",
					"Updated description",
				],
			},
		]);
	});

	it("executes skills remove action with structured argv", async () => {
		const calls: Array<{ command: string; args: string[] }> = [];
		const runCommandFn: RunCommandFn = async (command, args) => {
			calls.push({ command, args });
			return { code: 0, stdout: "ok", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({
			action: "skills",
			skillsAction: "remove",
			name: "backend-standard",
			projectId: "default",
		});

		expect(result.status).toBe("succeeded");
		expect(calls).toEqual([
			{
				command: "bun",
				args: [
					"run",
					"./packages/cli/src/index.ts",
					"skills",
					"remove",
					"backend-standard",
					"--project",
					"default",
				],
			},
		]);
	});

	it("rejects malformed skills and task requests without execution", async () => {
		let callCount = 0;
		const runCommandFn: RunCommandFn = async () => {
			callCount += 1;
			return { code: 0, stdout: "", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const malformedSkillsAction = await executor.execute({
			action: "skills",
		} as unknown as { action: string });
		const malformedSkillsAdd = await executor.execute({
			action: "skills",
			skillsAction: "add",
			description: "Rules",
			content: "Use consistent module boundaries.",
		} as unknown as { action: string });
		const malformedSkillsUpdate = await executor.execute({
			action: "skills",
			skillsAction: "update",
			name: "backend-standard",
		} as unknown as { action: string });
		const unsupportedSkillsAction = await executor.execute({
			action: "skills",
			skillsAction: "ship-it",
		} as unknown as { action: string });
		const malformedTaskAction = await executor.execute({
			action: "task",
		} as unknown as { action: string });
		const unsupportedTaskAction = await executor.execute({
			action: "task",
			taskAction: "archive",
		} as unknown as { action: string });
		const malformedTaskCreate = await executor.execute({
			action: "task",
			taskAction: "create",
			request: "   ",
		} as unknown as { action: string });
		const malformedSkillsListProject = await executor.execute({
			action: "skills",
			skillsAction: "list",
			projectId: 42,
		} as unknown as { action: string });
		const malformedSkillsUpdateOptional = await executor.execute({
			action: "skills",
			skillsAction: "update",
			name: "backend-standard",
			description: "Updated description",
			projectId: "",
		} as unknown as { action: string });
		const malformedTaskProject = await executor.execute({
			action: "task",
			taskAction: "create",
			request: "Build a better setup flow",
			projectId: 42,
		} as unknown as { action: string });
		const malformedRunFields = await executor.execute({
			action: "run",
			projectId: ["bad"],
			poll: "yes",
			concurrency: 0,
		} as unknown as { action: string });

		expect(malformedSkillsAction.status).toBe("rejected");
		expect(malformedSkillsAction.error).toContain("skillsAction is required");
		expect(malformedSkillsAdd.status).toBe("rejected");
		expect(malformedSkillsAdd.error).toContain("title is required");
		expect(malformedSkillsUpdate.status).toBe("rejected");
		expect(malformedSkillsUpdate.error).toContain(
			"at least one of title, description, or content is required",
		);
		expect(unsupportedSkillsAction.status).toBe("rejected");
		expect(unsupportedSkillsAction.error).toContain(
			"Unsupported skills action",
		);
		expect(malformedTaskAction.status).toBe("rejected");
		expect(malformedTaskAction.error).toContain("taskAction is required");
		expect(unsupportedTaskAction.status).toBe("rejected");
		expect(unsupportedTaskAction.error).toContain("Unsupported task action");
		expect(malformedTaskCreate.status).toBe("rejected");
		expect(malformedTaskCreate.error).toContain("request is required");
		expect(malformedSkillsListProject.status).toBe("rejected");
		expect(malformedSkillsListProject.error).toContain(
			"projectId must be a non-empty string",
		);
		expect(malformedSkillsUpdateOptional.status).toBe("rejected");
		expect(malformedSkillsUpdateOptional.error).toContain(
			"projectId must be a non-empty string",
		);
		expect(malformedTaskProject.status).toBe("rejected");
		expect(malformedTaskProject.error).toContain(
			"projectId must be a non-empty string",
		);
		expect(malformedRunFields.status).toBe("rejected");
		expect(malformedRunFields.error).toContain(
			"projectId must be a non-empty string",
		);
		expect(callCount).toBe(0);
	});
});
