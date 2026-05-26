import { describe, expect, it } from "bun:test";
import { SandboxAgent } from "../src";

describe("SandboxAgent", () => {
	it("stores workspace path and defaults to workspace-write sandbox", () => {
		const agent = new SandboxAgent({
			name: "Worker",
			instructions: "Work in a repo",
			workspacePath: "/tmp/work",
		});

		expect(agent.workspacePath).toBe("/tmp/work");
		expect(agent.sandbox).toBe("workspace-write");
	});

	it("stores explicit sandbox mode", () => {
		const agent = new SandboxAgent({
			name: "Reader",
			instructions: "Inspect only",
			workspacePath: "/tmp/work",
			sandbox: "read-only",
		});

		expect(agent.sandbox).toBe("read-only");
	});
});
