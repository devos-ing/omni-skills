import { describe, expect, it } from "bun:test";
import type { AgentAdapterRuntimeConfig, AgentResult } from "../src";
import {
	agentConfigurationDoc,
	availableAgentModels,
	createAgentAdapter,
	listAgentBackends,
	normalizeAgentBackend,
} from "../src";
import {
	CursorAgentAdapter,
	extractFinalMessage,
	extractSessionId,
	mapCursorError,
} from "../src/cursor";

const config: AgentAdapterRuntimeConfig = {
	workspacePath: "/tmp/work",
	executionPath: "/tmp/work/repo",
	codex: {
		binary: "codex",
		streamLogs: false,
	},
	cursor: {
		binary: "cursor-agent",
		streamLogs: false,
	},
};

describe("cursor agent registry", () => {
	it("creates cursor adapters and publishes registry metadata", () => {
		expect(
			createAgentAdapter({ ...config, agent: { backend: "cursor-agent" } }),
		).toBeInstanceOf(CursorAgentAdapter);
		expect(listAgentBackends().map((definition) => definition.backend)).toEqual(
			["codex", "claude-code", "cursor-agent", "github-copilot", "opencode"],
		);
		expect(normalizeAgentBackend(" Cursor-Agent ")).toBe("cursor-agent");
		expect(availableAgentModels["cursor-agent"][0]?.id).toBe("auto");
		expect(agentConfigurationDoc["cursor-agent"].defaults.model).toBe("auto");
	});
});

describe("cursor agent adapter", () => {
	it("builds new-session and resume command arguments", async () => {
		const adapter = new CursorAgentAdapter({
			...config,
			cursor: {
				binary: "cursor-agent",
				streamLogs: false,
				model: "gpt-5",
				force: true,
			},
		});
		const calls: string[][] = [];
		(
			adapter as unknown as {
				runCursor: (args: string[]) => Promise<AgentResult>;
			}
		).runCursor = async (args: string[]) => {
			calls.push(args);
			return { finalMessage: "", stdout: "" };
		};

		await adapter.runPlan("plan prompt");
		await adapter.runReview("review prompt");
		await adapter.runGithubComment("comment prompt");
		await adapter.resume("session-1", "implement prompt");

		expect(calls[0]).toEqual([
			"-p",
			"plan prompt",
			"--output-format",
			"json",
			"--model",
			"gpt-5",
			"--force",
		]);
		expect(calls[1]?.[1]).toBe("review prompt");
		expect(calls[2]?.[1]).toBe("comment prompt");
		expect(calls[3]).toEqual([
			"--resume",
			"session-1",
			"-p",
			"implement prompt",
			"--output-format",
			"json",
			"--model",
			"gpt-5",
			"--force",
		]);
	});

	it("omits the model arg for auto model selection", async () => {
		const adapter = new CursorAgentAdapter({
			...config,
			cursor: {
				binary: "cursor-agent",
				streamLogs: false,
				model: "auto",
			},
		});
		const calls: string[][] = [];
		(
			adapter as unknown as {
				runCursor: (args: string[]) => Promise<AgentResult>;
			}
		).runCursor = async (args: string[]) => {
			calls.push(args);
			return { finalMessage: "", stdout: "" };
		};

		await adapter.runPlan("prompt");

		expect(calls[0]).not.toContain("--model");
		expect(calls[0]).not.toContain("--force");
	});

	it("extracts normalized result fields from json output", () => {
		const json =
			'{"type":"result","subtype":"success","result":"done","session_id":"abc-123","extra":true}';

		expect(extractFinalMessage(json)).toBe("done");
		expect(extractSessionId(json)).toBe("abc-123");
		expect(extractFinalMessage("not json")).toBe("not json");
	});

	it("maps common cursor failures with actionable hints", () => {
		expect(
			mapCursorError("cursor-agent", ["-p", "x"], {
				code: 127,
				stdout: "",
				stderr: "command not found: cursor-agent",
			}).message,
		).toContain("Cursor Agent binary not found");
		expect(
			mapCursorError("cursor-agent", ["-p", "x"], {
				code: 1,
				stdout: "",
				stderr: "authentication failed",
			}).message,
		).toContain("cursor-agent login");
		expect(
			mapCursorError("cursor-agent", ["-p", "x"], {
				code: 1,
				stdout: "",
				stderr: "model not found",
			}).message,
		).toContain("CURSOR_AGENT_MODEL");
	});

	it("maps spawn failures for missing cursor binaries", async () => {
		const adapter = new CursorAgentAdapter({
			...config,
			cursor: {
				binary: "__missing_cursor_agent_binary__",
				streamLogs: false,
			},
		});

		await expect(adapter.runPlan("prompt")).rejects.toThrow(
			"Cursor Agent binary not found",
		);
	});
});
