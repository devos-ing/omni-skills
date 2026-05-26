import { describe, expect, it } from "bun:test";
import { FunctionTool, HostedTool, McpTool } from "../src";

describe("Tools", () => {
	it("invokes synchronous function tools", () => {
		const tool = new FunctionTool({
			name: "double",
			description: "Double a number",
			invoke: (input: number) => input * 2,
		});

		expect(tool.name).toBe("double");
		expect(tool.description).toBe("Double a number");
		expect(tool.invoke(3)).toBe(6);
	});

	it("invokes asynchronous MCP tools", async () => {
		const tool = new McpTool({
			name: "lookup",
			invoke: async (input: string) => `found:${input}`,
		});

		await expect(tool.invoke("task")).resolves.toBe("found:task");
	});

	it("invokes hosted tools through the same contract", async () => {
		const tool = new HostedTool({
			name: "hosted-search",
			invoke: async (input: { query: string }) => ({
				answer: input.query.toUpperCase(),
			}),
		});

		await expect(tool.invoke({ query: "agents" })).resolves.toEqual({
			answer: "AGENTS",
		});
	});
});
