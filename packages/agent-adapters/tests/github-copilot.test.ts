import { describe, expect, it } from "bun:test";
import type { AgentAdapterRuntimeConfig, AgentResult } from "../src";
import {
	agentConfigurationDoc,
	availableAgentModels,
	createAgentAdapter,
	listAgentBackends,
	normalizeAgentBackend,
} from "../src";
import { GitHubCopilotAdapter } from "../src/github-copilot/adapter";
import { mapGitHubCopilotError } from "../src/github-copilot/errors";
import { extractFinalMessage } from "../src/github-copilot/output";

const config: AgentAdapterRuntimeConfig = {
	workspacePath: "/tmp/work",
	executionPath: "/tmp/work/repo",
	codex: {
		binary: "codex",
		streamLogs: false,
	},
	githubCopilot: {
		binary: "copilot",
		streamLogs: false,
	},
};

describe("github copilot registry", () => {
	it("creates github copilot adapters and publishes registry metadata", () => {
		expect(
			createAgentAdapter({ ...config, agent: { backend: "github-copilot" } }),
		).toBeInstanceOf(GitHubCopilotAdapter);
		expect(listAgentBackends().map((definition) => definition.backend)).toEqual(
			["codex", "claude-code", "cursor-agent", "github-copilot", "opencode"],
		);
		expect(normalizeAgentBackend(" GitHub-Copilot ")).toBe("github-copilot");
		expect(availableAgentModels["github-copilot"][0]?.id).toBe("auto");
		expect(agentConfigurationDoc["github-copilot"].defaults.model).toBe("auto");
	});
});

describe("github copilot adapter", () => {
	it("builds prompt and tool permission command arguments", async () => {
		const adapter = new GitHubCopilotAdapter({
			...config,
			githubCopilot: {
				binary: "copilot",
				streamLogs: false,
				allowAllTools: true,
				allowTools: ["shell(git)", "file(*)"],
				denyTools: ["shell(rm)"],
			},
		});
		const calls: string[][] = [];
		(
			adapter as unknown as {
				runGitHubCopilot: (args: string[]) => Promise<AgentResult>;
			}
		).runGitHubCopilot = async (args: string[]) => {
			calls.push(args);
			return { finalMessage: "", stdout: "" };
		};

		await adapter.runPlan("plan prompt");
		await adapter.resume("session-1", "implement prompt");

		expect(calls[0]?.slice(0, 2)).toEqual(["-p", "plan prompt"]);
		expect(calls[0]).toContain("--allow-all-tools");
		expect(calls[0]).toContain("shell(git)");
		expect(calls[0]).toContain("file(*)");
		expect(calls[0]).toContain("shell(rm)");
		expect(calls[1]?.[1]).toContain("Previous GitHub Copilot session id");
		expect(calls[1]?.[1]).toContain("session-1");
	});

	it("passes configured environment variables", () => {
		const adapter = new GitHubCopilotAdapter({
			...config,
			githubCopilot: {
				binary: "copilot",
				streamLogs: false,
				model: "gpt-5",
				copilotHome: "/tmp/copilot",
				githubToken: "token-secret",
			},
		});
		const env = (
			adapter as unknown as {
				buildEnv: () => Record<string, string> | undefined;
			}
		).buildEnv();

		expect(env).toEqual({
			COPILOT_MODEL: "gpt-5",
			COPILOT_HOME: "/tmp/copilot",
			COPILOT_GITHUB_TOKEN: "token-secret",
		});
	});

	it("renders structured runAgent prompts and preserves trace context", async () => {
		const adapter = new GitHubCopilotAdapter(config);
		const calls: { args: string[]; traceId?: string }[] = [];
		(
			adapter as unknown as {
				runGitHubCopilot: (
					args: string[],
					request: { traceId?: string },
				) => Promise<AgentResult>;
			}
		).runGitHubCopilot = async (args, request) => {
			calls.push({ args, traceId: request.traceId });
			return { finalMessage: "done", stdout: "", traceId: request.traceId };
		};

		const result = await adapter.runAgent({
			role: "planning",
			prompt: "Plan this",
			traceId: "trace-1",
			agent: { name: "Planner", instructions: "Plan carefully" },
			customInstructions: "Return markers",
			skills: [{ name: "plan", path: "skills/plan/SKILL.md" }],
		});

		expect(calls[0]?.args[1]).toContain("Agent instructions:");
		expect(calls[0]?.args[1]).toContain("skills/plan/SKILL.md");
		expect(calls[0]?.traceId).toBe("trace-1");
		expect(result).toMatchObject({ traceId: "trace-1" });
	});

	it("extracts plain stdout as the final message", () => {
		expect(extractFinalMessage("done\n")).toBe("done");
		expect(extractFinalMessage("")).toBe("");
	});

	it("maps common github copilot failures with actionable hints", () => {
		expect(
			mapGitHubCopilotError("copilot", ["-p", "x"], {
				code: 127,
				stdout: "",
				stderr: "command not found: copilot",
			}).message,
		).toContain("GITHUB_COPILOT_BINARY");
		expect(
			mapGitHubCopilotError("copilot", ["-p", "x"], {
				code: 1,
				stdout: "",
				stderr: "authentication token expired",
			}).message,
		).toContain("GITHUB_COPILOT_TOKEN");
		expect(
			mapGitHubCopilotError("copilot", ["-p", "x"], {
				code: 1,
				stdout: "",
				stderr: "model not found",
			}).message,
		).toContain("GITHUB_COPILOT_MODEL");
	});

	it("maps spawn failures for missing github copilot binaries", async () => {
		const adapter = new GitHubCopilotAdapter({
			...config,
			githubCopilot: {
				binary: "__missing_github_copilot_binary__",
				streamLogs: false,
			},
		});

		await expect(adapter.runPlan("prompt")).rejects.toThrow(
			"GitHub Copilot CLI binary not found",
		);
	});
});
