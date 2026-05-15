import { describe, expect, it } from "bun:test";
import { assertCommandOk, runCommand } from "../src/utils/shell";

describe("runCommand", () => {
	it("invokes output callbacks while retaining final captured output", async () => {
		const stdout: string[] = [];
		const stderr: string[] = [];

		const result = await runCommand(
			process.execPath,
			["-e", "console.log('out'); console.error('err')"],
			{
				cwd: process.cwd(),
				onStdout: (text) => stdout.push(text),
				onStderr: (text) => stderr.push(text),
			},
		);

		expect(result.code).toBe(0);
		expect(stdout.join("")).toBe(result.stdout);
		expect(stderr.join("")).toBe(result.stderr);
		expect(result.stdout).toContain("out");
		expect(result.stderr).toContain("err");
	});

	it("returns a timeout result when the child process exceeds timeoutMs", async () => {
		const result = await runCommand(
			process.execPath,
			["-e", "setTimeout(() => {}, 1000)"],
			{
				cwd: process.cwd(),
				timeoutMs: 10,
			},
		);

		expect(result.code).toBe(124);
		expect(result.stderr).toContain("timed out after 10ms");
	});

	it("surfaces child output before the command preview on failure", () => {
		expect(() =>
			assertCommandOk("codex", ["exec", "very long prompt"], {
				code: 1,
				stdout: "",
				stderr: "Error: No such file or directory (os error 2)",
			}),
		).toThrow(
			[
				"codex failed with exit code 1",
				"stderr:",
				"Error: No such file or directory (os error 2)",
				"command: codex exec",
			].join("\n"),
		);
	});
});
