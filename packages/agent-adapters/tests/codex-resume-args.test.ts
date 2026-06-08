import { describe, expect, it } from "bun:test";
import type { AgentResult } from "../src";
import { CodexAdapter } from "../src/codex";
import { config } from "./fixtures";

describe("codex resume args", () => {
	it("carries sandbox mode through resumed implementation sessions", async () => {
		const adapter = new CodexAdapter(config);
		const calls: string[][] = [];
		(
			adapter as unknown as {
				runCodex: (args: string[]) => Promise<AgentResult>;
			}
		).runCodex = async (args: string[]) => {
			calls.push(args);
			return { finalMessage: "", stdout: "" };
		};
		(
			adapter as unknown as { nextOutputFile: () => Promise<string> }
		).nextOutputFile = async () => "/tmp/out.txt";

		await adapter.resume("session-1", "implement prompt");

		expect(calls).toHaveLength(1);
		expect(calls[0]).toContain("--config");
		expect(calls[0]).toContain('sandbox_mode="workspace-write"');
	});

	it("adds the execution path as a writable directory for resumed sessions", async () => {
		const adapter = new CodexAdapter(config);
		const calls: string[][] = [];
		(
			adapter as unknown as {
				runCodex: (args: string[]) => Promise<AgentResult>;
			}
		).runCodex = async (args: string[]) => {
			calls.push(args);
			return { finalMessage: "", stdout: "" };
		};
		(
			adapter as unknown as { nextOutputFile: () => Promise<string> }
		).nextOutputFile = async () => "/tmp/out.txt";

		await adapter.resume("session-1", "implement prompt");

		expect(calls).toHaveLength(1);
		expect(calls[0]?.slice(0, 4)).toEqual([
			"exec",
			"--add-dir",
			config.executionPath,
			"resume",
		]);
	});
});
