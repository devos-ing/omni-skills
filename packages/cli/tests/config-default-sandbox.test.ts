import { describe, expect, it } from "bun:test";
import { buildEnvBase } from "../src/features/config/env";

describe("config Codex sandbox defaults", () => {
	it("defaults Codex sandbox to workspace-write when env is unset", () => {
		const config = buildEnvBase("/repo", {});

		expect(config.codex.sandbox).toBe("workspace-write");
	});

	it("preserves explicit supported Codex sandbox values", () => {
		const config = buildEnvBase("/repo", { CODEX_SANDBOX: "read-only" });

		expect(config.codex.sandbox).toBe("read-only");
	});
});
