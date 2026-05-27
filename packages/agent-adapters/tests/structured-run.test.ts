import { describe, expect, it } from "bun:test";
import type { AgentResult } from "../src";
import { AgentAdapterError, runAdapterAgent } from "../src";
import { CodexAdapter } from "../src/codex";
import { config } from "./fixtures";

describe("structured adapter runs", () => {
	it("builds runAgent requests with instructions and skillsets", async () => {
		const adapter = new CodexAdapter(config);
		const calls: string[][] = [];
		(
			adapter as unknown as {
				runCodex: (args: string[]) => Promise<AgentResult>;
			}
		).runCodex = async (args: string[]) => {
			calls.push(args);
			return {
				finalMessage: "done",
				stdout: "",
				traceId: "trace-1",
				backend: "codex",
			};
		};
		(
			adapter as unknown as { nextOutputFile: () => Promise<string> }
		).nextOutputFile = async () => "/tmp/out.txt";

		await adapter.runAgent({
			role: "planning",
			prompt: "Plan this",
			traceId: "trace-1",
			agent: { name: "Planner", instructions: "Plan carefully" },
			customInstructions: "Return markers",
			skills: [{ name: "plan", path: "skills/plan/SKILL.md" }],
			skillsets: ["repo"],
		});

		expect(calls[0]).toContain('skillsets=["devos", "repo"]');
		const prompt = calls[0]?.at(-1) ?? "";
		expect(prompt).toContain("Agent instructions:");
		expect(prompt).toContain("Custom instructions:");
		expect(prompt).toContain("skills/plan/SKILL.md");
	});

	it("falls back through role methods for legacy adapter implementations", async () => {
		const calls: string[] = [];
		const result = await runAdapterAgent(
			{
				runPlan: async () => {
					calls.push("plan");
					return { finalMessage: "plan", stdout: "" };
				},
				runTaskIntake: async () => ({ finalMessage: "", stdout: "" }),
				resume: async () => ({ finalMessage: "", stdout: "" }),
				runReview: async () => ({ finalMessage: "", stdout: "" }),
				runGithubComment: async () => ({ finalMessage: "", stdout: "" }),
			},
			{ role: "planning", prompt: "plan" },
		);

		expect(result.finalMessage).toBe("plan");
		expect(calls).toEqual(["plan"]);
	});

	it("validates run requests before invoking legacy adapters", async () => {
		let invoked = false;

		await expect(
			runAdapterAgent(
				{
					runPlan: async () => {
						invoked = true;
						return { finalMessage: "plan", stdout: "" };
					},
					runTaskIntake: async () => ({ finalMessage: "", stdout: "" }),
					resume: async () => ({ finalMessage: "", stdout: "" }),
					runReview: async () => ({ finalMessage: "", stdout: "" }),
					runGithubComment: async () => ({ finalMessage: "", stdout: "" }),
				},
				{ role: "planning", prompt: 42 } as never,
			),
		).rejects.toThrow("Agent adapter run request validation failed");

		expect(invoked).toBe(false);
	});

	it("validates direct provider runAgent requests before command execution", async () => {
		const adapter = new CodexAdapter(config);
		let invoked = false;
		(
			adapter as unknown as {
				runCodex: (args: string[]) => Promise<AgentResult>;
			}
		).runCodex = async () => {
			invoked = true;
			return { finalMessage: "", stdout: "" };
		};

		await expect(
			adapter.runAgent({ role: "planning", prompt: 42 } as never),
		).rejects.toThrow("Agent adapter run request validation failed");
		expect(invoked).toBe(false);
	});

	it("carries structured metadata on adapter errors", () => {
		const error = new AgentAdapterError({
			backend: "codex",
			message: "failed",
			command: "codex",
			args: ["exec"],
			cwd: "/tmp/work",
			code: 1,
			stdout: "out",
			stderr: "err",
			traceId: "trace-1",
		});

		expect(error).toMatchObject({
			backend: "codex",
			command: "codex",
			code: 1,
			traceId: "trace-1",
		});
	});
});
