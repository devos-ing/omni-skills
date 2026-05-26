import { describe, expect, it } from "bun:test";
import { Agent, InputGuardrail, OutputGuardrail, run } from "../src";

describe("Agent", () => {
	it("runs through the public run helper with a custom runner", async () => {
		const agent = new Agent<string, string>({
			name: "Assistant",
			instructions: "Be concise",
			runner: {
				run: async ({ input }) => ({
					output: `ok: ${input}`,
					finalMessage: `ok: ${input}`,
				}),
			},
		});

		await expect(run(agent, "hello")).resolves.toMatchObject({
			output: "ok: hello",
			finalMessage: "ok: hello",
		});
	});

	it("uses the default echo runner and passes session and trace ids through", async () => {
		const agent = new Agent({ name: "Echo", instructions: "Echo input" });

		const result = await agent.run("hello", {
			sessionId: "session-1",
			traceId: "trace-1",
		});

		expect(result).toEqual({
			output: "hello",
			finalMessage: "hello",
			sessionId: "session-1",
			traceId: "trace-1",
		});
	});

	it("fails input guardrails before invoking the runner", async () => {
		let invoked = false;
		const agent = new Agent<string, string>({
			name: "Guarded",
			instructions: "Reject empty input",
			guardrails: [
				new InputGuardrail({
					name: "not-empty",
					check: ({ input }) => ({ ok: input !== "", reason: "empty input" }),
				}),
			],
			runner: {
				run: async () => {
					invoked = true;
					return { output: "never", finalMessage: "never" };
				},
			},
		});

		await expect(agent.run("")).rejects.toThrow(
			"input guardrail 'not-empty' failed: empty input",
		);
		expect(invoked).toBe(false);
	});

	it("fails output guardrails after invoking the runner", async () => {
		const agent = new Agent<string, string>({
			name: "Reviewer",
			instructions: "Return output",
			guardrails: [
				new OutputGuardrail({
					name: "not-blocked",
					check: ({ output }) => ({
						ok: output !== "blocked",
						reason: "blocked output",
					}),
				}),
			],
			runner: {
				run: async () => ({ output: "blocked", finalMessage: "blocked" }),
			},
		});

		await expect(agent.run("go")).rejects.toThrow(
			"output guardrail 'not-blocked' failed: blocked output",
		);
	});
});
