import { describe, expect, it } from "bun:test";
import { createChatSessionActivityBubbles } from "../src/components/chat-room/chat-session-activity-state";
import type { ChatMissionProgressViewModel } from "../src/components/chat-room/types/chat-mission-progress.types";
import type { ChatStreamLine } from "../src/components/chat-room/types/chat-room.types";

describe("chat session activity state", () => {
	it("collapses repeated file reads into one latest activity bubble", () => {
		const bubbles = createChatSessionActivityBubbles({
			missionProgress: null,
			streamLines: [
				streamLine("line-1", "cat packages/web/AGENTS.md"),
				streamLine("line-2", "sed -n 1,120p packages/web/src/page.tsx"),
			],
		});

		expect(bubbles).toEqual([
			{
				id: "stream:line-2:reading-files",
				kind: "reading-files",
				label: "Reading files...",
			},
		]);
	});

	it("uses the latest recognized mission log instead of old raw output", () => {
		const bubbles = createChatSessionActivityBubbles({
			missionProgress: missionWithLogs([
				{ id: "line-1", stream: "stdout", text: "rg streamLines packages/web" },
				{
					id: "line-2",
					stream: "stdout",
					text: "apply_patch chat-transcript.tsx",
				},
			]),
			streamLines: [],
		});

		expect(bubbles).toEqual([
			{
				id: "mission:line-2:writing",
				kind: "writing",
				label: "Writing changes...",
			},
		]);
	});

	it("surfaces MCP activity with the plugin name when structured data has it", () => {
		const bubbles = createChatSessionActivityBubbles({
			missionProgress: missionWithLogs([
				{
					id: "line-1",
					stream: "stdout",
					text: JSON.stringify({
						type: "tool_call.started",
						recipient_name: "mcp__github__search_issues",
					}),
				},
			]),
			streamLines: [],
		});

		expect(bubbles).toEqual([
			{
				id: "mission:line-1:tool",
				kind: "tool",
				label: "Running MCP: GitHub...",
			},
		]);
	});

	it("classifies skills, docs, browsing, and coding conservatively", () => {
		expect(activityLabel("Reading skills/plan/SKILL.md")).toBe(
			"Reading skills...",
		);
		expect(activityLabel("Searching OpenAI docs for Responses API")).toBe(
			"Reading docs...",
		);
		expect(activityLabel("web.run search_query app router examples")).toBe(
			"Browsing websites...",
		);
		expect(activityLabel("bun test packages/web/tests/chat-room.test.ts")).toBe(
			"Coding...",
		);
	});

	it("suppresses unknown output and terminal mission activity", () => {
		expect(
			createChatSessionActivityBubbles({
				missionProgress: null,
				streamLines: [streamLine("line-1", "agent output is still warming up")],
			}),
		).toEqual([]);
		expect(
			createChatSessionActivityBubbles({
				missionProgress: missionWithLogs(
					[
						{
							id: "line-1",
							stream: "stdout",
							text: "apply_patch chat-transcript.tsx",
						},
					],
					"done",
				),
				streamLines: [],
			}),
		).toEqual([]);
	});
});

function activityLabel(text: string): string | undefined {
	return createChatSessionActivityBubbles({
		missionProgress: null,
		streamLines: [streamLine("line-1", text)],
	})[0]?.label;
}

function streamLine(id: string, text: string): ChatStreamLine {
	return { id, stream: "stdout", text };
}

function missionWithLogs(
	logs: Array<{
		id: string;
		stream: "stdout" | "stderr" | "system";
		text: string;
	}>,
	status = "in_progress",
): ChatMissionProgressViewModel {
	return {
		state: "ready",
		taskId: "task-1",
		taskKey: "TASK-1",
		title: "Activity task",
		status,
		statusLabel: "Implementing",
		updatedAt: "2026-05-29T00:00:00.000Z",
		notes: [],
		executions: [],
		latestLogLines: logs,
		latestResult: null,
		usageSummary: null,
		phaseCheckpoints: { plan: [], implement: [], testing: [], qa: [] },
		phaseLogLines: { plan: [], implement: [], testing: [], qa: [] },
		phases: [],
	};
}
