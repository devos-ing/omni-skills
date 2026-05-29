import { describe, expect, it } from "bun:test";
import type { ResolvedProjectConfig, RunState } from "../src/features/types";
import { isolatedWorktreePath } from "../src/features/workflow/runtime/workflow-worktree";

describe("isolatedWorktreePath", () => {
	it("uses board task branch names for scoped task worktree paths", () => {
		const config = {
			id: "default",
			workspacePath: "/tmp/workspace",
			workflow: {
				isolatedWorktrees: {
					enabled: true,
					root: "/tmp/worktrees",
				},
			},
		} as ResolvedProjectConfig;
		const state = {
			issue: {
				key: "TASK(OWNER-1)-34",
				branchName: "OWN-34",
			},
		} as RunState;

		expect(isolatedWorktreePath(config, state)).toBe(
			"/tmp/worktrees/default/own-34",
		);
	});
});
