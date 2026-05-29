import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { RunState } from "../src/features/types";
import {
	normalizeIssueKey,
	transitionStage,
} from "../src/features/workflow/state";
import {
	AGENT_CHAT_LOG_RETENTION,
	agentChatLogPath,
	appendAgentChatLog,
} from "../src/features/workflow/state-chat-log";
import {
	appendProjectErrorLog,
	projectErrorLogPath,
} from "../src/features/workflow/state-error-log";
import {
	applyRunLease,
	clearRunLease,
	hasRunLeaseConflict,
	isRunLeaseExpired,
} from "../src/features/workflow/state-lease";

describe("state helpers", () => {
	it("normalizes issue key from URL", () => {
		const key = normalizeIssueKey(
			"https://linear.app/acme/issue/ENG-321/task-name",
		);
		expect(key).toBe("ENG-321");
	});

	it("keeps scoped task keys unique when normalizing", () => {
		expect(normalizeIssueKey("TASK(owner-1)-34")).toBe("TASK(OWNER-1)-34");
		expect(normalizeIssueKey("TASK(OWNER-1)-33")).toBe("TASK(OWNER-1)-33");
	});

	it("transitions stage", () => {
		const now = new Date().toISOString();
		const state: RunState = {
			projectId: "default",
			projectName: "Default",
			workspacePath: "/tmp/work",
			repository: {
				owner: "o",
				name: "n",
				baseBranch: "main",
			},
			issue: { id: "1", key: "ENG-1", title: "t", url: "u" },
			stage: "plan",
			bugs: [],
			startedAt: now,
			updatedAt: now,
		};
		const next = transitionStage(state, "in_progress");
		expect(next.stage).toBe("in_progress");
	});

	it("applies and clears lease metadata", () => {
		const now = new Date().toISOString();
		const state: RunState = {
			projectId: "default",
			projectName: "Default",
			workspacePath: "/tmp/work",
			repository: {
				owner: "o",
				name: "n",
				baseBranch: "main",
			},
			issue: { id: "1", key: "ENG-1", title: "t", url: "u" },
			stage: "plan",
			bugs: [],
			startedAt: now,
			updatedAt: now,
		};

		const leased = applyRunLease(state, "worker-1", 30000, 1000);
		expect(leased.lease?.ownerId).toBe("worker-1");
		expect(leased.lease?.acquiredAt).toBe("1970-01-01T00:00:01.000Z");
		expect(leased.lease?.expiresAt).toBe("1970-01-01T00:00:31.000Z");

		const cleared = clearRunLease(leased);
		expect(cleared.lease).toBeUndefined();
	});

	it("detects lease expiry and conflicts", () => {
		const now = new Date().toISOString();
		const state: RunState = {
			projectId: "default",
			projectName: "Default",
			workspacePath: "/tmp/work",
			repository: {
				owner: "o",
				name: "n",
				baseBranch: "main",
			},
			issue: { id: "1", key: "ENG-1", title: "t", url: "u" },
			stage: "plan",
			bugs: [],
			lease: {
				ownerId: "worker-a",
				acquiredAt: "1970-01-01T00:00:00.000Z",
				heartbeatAt: "1970-01-01T00:00:05.000Z",
				expiresAt: "1970-01-01T00:00:10.000Z",
			},
			startedAt: now,
			updatedAt: now,
		};

		expect(isRunLeaseExpired(state, 9999)).toBe(false);
		expect(isRunLeaseExpired(state, 10000)).toBe(true);
		expect(hasRunLeaseConflict(state, "worker-b", 9999)).toBe(true);
		expect(hasRunLeaseConflict(state, "worker-a", 9999)).toBe(false);
	});

	it("builds project-scoped error log paths", () => {
		const logPath = projectErrorLogPath("/tmp/workspace", "default");
		expect(logPath).toBe("/tmp/workspace/.devos/projects/default/errors.log");
	});

	it("appends project polling errors as JSON lines", async () => {
		const cwd = await mkdtemp(path.join(os.tmpdir(), "adhd-state-test-"));
		await appendProjectErrorLog(cwd, "default", {
			cycle: 3,
			message: "Linear API failed",
			error: {
				name: "Error",
				message: "boom",
			},
			context: {
				projectName: "Default",
			},
		});

		const content = await readFile(projectErrorLogPath(cwd, "default"), "utf8");
		const entry = JSON.parse(content.trim()) as Record<string, unknown>;
		expect(entry.projectId).toBe("default");
		expect(entry.cycle).toBe(3);
		expect(entry.message).toBe("Linear API failed");
		expect(typeof entry.recordedAt).toBe("string");
		expect(entry.error).toEqual({
			name: "Error",
			message: "boom",
		});
		expect(entry.context).toEqual({
			projectName: "Default",
		});
	});

	it("builds project-scoped agent chat log paths", () => {
		const file = agentChatLogPath(
			"/tmp/workspace",
			"default",
			"review-testing",
			"skills/piv-review-test/SKILL.md",
		);

		expect(file).toContain("/tmp/workspace/.devos/projects/default/chat-logs/");
		expect(file).toContain("/review-testing/");
		expect(path.basename(file)).toMatch(
			/^skills-piv-review-test-skill-md-[a-f0-9]{8}\.json$/,
		);
	});

	it("builds chat log paths for github-comment role", () => {
		const file = agentChatLogPath(
			"/tmp/workspace",
			"default",
			"github-comment",
			"skills/piv-github-comment/SKILL.md",
		);

		expect(file).toContain("/github-comment/");
	});

	it("retains only the latest agent chat log entries", async () => {
		const cwd = await mkdtemp(path.join(os.tmpdir(), "adhd-chat-log-test-"));
		const totalEntries = AGENT_CHAT_LOG_RETENTION + 5;
		for (let i = 1; i <= totalEntries; i += 1) {
			await appendAgentChatLog(cwd, "default", {
				projectId: "default",
				issueKey: "ENG-1",
				issueId: "lin_1",
				issueTitle: "Store logs",
				agentRole: "planning",
				skillPath: "skills/piv-plan/SKILL.md",
				prompt: `prompt-${i}`,
				finalMessage: `final-${i}`,
				stdout: `stdout-${i}`,
				success: true,
				recordedAt: new Date().toISOString(),
			});
		}

		const file = agentChatLogPath(
			cwd,
			"default",
			"planning",
			"skills/piv-plan/SKILL.md",
		);
		const raw = await readFile(file, "utf8");
		const entries = JSON.parse(raw) as Array<{
			prompt: string;
			finalMessage: string;
		}>;
		expect(entries).toHaveLength(AGENT_CHAT_LOG_RETENTION);
		expect(entries[0]?.prompt).toBe("prompt-6");
		expect(entries[0]?.finalMessage).toBe("final-6");
		expect(entries.at(-1)?.prompt).toBe(`prompt-${totalEntries}`);
	});
});
