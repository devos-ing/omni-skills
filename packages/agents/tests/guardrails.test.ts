import { describe, expect, it } from "bun:test";
import {
	BasicGuardrail,
	InputGuardrail,
	OutputGuardrail,
	ToolGuardrail,
	guardrailPass,
} from "../src";

describe("Guardrails", () => {
	it("creates input, output, and tool guardrails with the expected stages", () => {
		const input = new InputGuardrail({
			name: "input",
			check: () => guardrailPass(),
		});
		const output = new OutputGuardrail({
			name: "output",
			check: () => guardrailPass(),
		});
		const tool = new ToolGuardrail({
			name: "tool",
			check: () => guardrailPass(),
		});

		expect(input.stage).toBe("input");
		expect(output.stage).toBe("output");
		expect(tool.stage).toBe("tool");
	});

	it("runs basic guardrail checks and returns pass/fail results", async () => {
		const guardrail = new BasicGuardrail({
			name: "starts-with-a",
			stage: "input",
			check: ({ input }) => ({
				ok: String(input).startsWith("a"),
				reason: "must start with a",
			}),
		});

		expect(guardrail.check({ agent: "Assistant", input: "agent" })).toEqual({
			ok: true,
			reason: "must start with a",
		});
		expect(guardrail.check({ agent: "Assistant", input: "bot" })).toEqual({
			ok: false,
			reason: "must start with a",
		});
	});

	it("returns a standard pass result", () => {
		expect(guardrailPass()).toEqual({ ok: true });
	});
});
