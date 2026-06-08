import { describe, expect, it } from "bun:test";
import path from "node:path";
import { buildCodexRuntimeInvocation } from "../src/codex/docker";
import { config } from "./fixtures";

describe("codex runtime paths", () => {
	it("absolutizes add-dir values for host invocations", () => {
		const invocation = buildCodexRuntimeInvocation(
			{
				...config,
				workspacePath: ".",
				executionPath: ".devos/projects/default/worktrees/eng-1",
			},
			[
				"exec",
				"--add-dir",
				".devos/projects/default/worktrees/eng-1",
				"resume",
				"--output-last-message",
				".devos/tmp/out.txt",
				"session-1",
				"prompt",
			],
		);

		const addDirIndex = invocation.args.indexOf("--add-dir");
		expect(invocation.args[addDirIndex + 1]).toBe(
			path.resolve(".devos/projects/default/worktrees/eng-1"),
		);
	});

	it("maps add-dir values into the docker container", () => {
		const invocation = buildCodexRuntimeInvocation(
			{
				...config,
				workspacePath: ".",
				executionPath: ".devos/projects/default/worktrees/eng-1",
				codex: {
					...config.codex,
					docker: {
						enabled: true,
						image: "codex:latest",
					},
				},
			},
			[
				"exec",
				"--add-dir",
				".devos/projects/default/worktrees/eng-1",
				"resume",
				"--output-last-message",
				".devos/tmp/out.txt",
				"session-1",
				"prompt",
			],
		);

		const addDirIndex = invocation.args.indexOf("--add-dir");
		expect(invocation.args[addDirIndex + 1]).toBe(
			"/workspace/.devos/projects/default/worktrees/eng-1",
		);
	});
});
