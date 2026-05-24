import { describe, expect, it } from "bun:test";
import { CodexAdapter } from "adapters/codex";

describe("codex MCP config overrides", () => {
	it("passes enabled plugin MCP servers to Codex config", () => {
		const adapter = new CodexAdapter({
			workspacePath: "/tmp/work",
			executionPath: "/tmp/work",
			codex: {
				binary: "codex",
				streamLogs: false,
				mcpServers: [
					{
						name: "slack",
						command: "bun",
						args: ["run", "src/worker.ts"],
						env: { SLACK_BOT_TOKEN: "xoxb-secret" },
					},
				],
			},
		});
		const overrides = (
			adapter as unknown as {
				buildConfigOverrides: () => string[];
			}
		).buildConfigOverrides();

		expect(overrides).toContain('mcp_servers."slack".command="bun"');
		expect(overrides).toContain(
			'mcp_servers."slack".args=["run", "src/worker.ts"]',
		);
		expect(overrides).toContain(
			'mcp_servers."slack".env.SLACK_BOT_TOKEN="xoxb-secret"',
		);
	});
});
