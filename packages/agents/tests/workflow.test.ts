import { describe, expect, it } from "bun:test";
import { Agent, Workflow } from "../src";

describe("Workflow", () => {
	it("uses phases as the canonical phase list", async () => {
		const workflow = new Workflow({
			name: "Build",
			phases: [{ title: "Plan" }],
			agents: [agent("Assistant")],
		});

		const call = await workflow.setPhase("Plan").callAgent("Assistant", "x");

		expect(call).toMatchObject({
			phase: "Plan",
			agent: "Assistant",
			result: { output: "Assistant: x" },
		});
	});

	it("supports phrases and setPhrase as compatibility aliases", async () => {
		const workflow = new Workflow({
			name: "Compat",
			phrases: [{ title: "Plan" }],
			agents: [agent("Assistant")],
		});

		const call = await workflow.setPhrase("Plan").callAgent("Assistant", "x");

		expect(call.phase).toBe("Plan");
		expect(call.result.output).toBe("Assistant: x");
	});

	it("adds agents after construction", async () => {
		const workflow = new Workflow({
			name: "Dynamic",
			phases: [{ title: "Review" }],
		});

		workflow.addAgent(agent("Reviewer"));

		await expect(
			workflow.setPhase("Review").callAgent("Reviewer", "ship"),
		).resolves.toMatchObject({
			agent: "Reviewer",
			result: { finalMessage: "Reviewer: ship" },
		});
	});

	it("throws for unknown phases and agents", async () => {
		const workflow = new Workflow({
			name: "Errors",
			phases: [{ title: "Plan" }],
			agents: [agent("Assistant")],
		});

		expect(() => workflow.setPhase("Missing")).toThrow(
			"Unknown workflow phase: Missing",
		);
		await expect(
			workflow.setPhase("Plan").callAgent("Missing", "x"),
		).rejects.toThrow("Unknown workflow agent: Missing");
	});
});

function agent(name: string): Agent<string, string> {
	return new Agent({
		name,
		instructions: `Run ${name}`,
		runner: {
			run: async ({ input }) => ({
				output: `${name}: ${input}`,
				finalMessage: `${name}: ${input}`,
			}),
		},
	});
}
