import { describe, expect, it } from "bun:test";
import { createChatSessionActivitySections } from "../src/components/chat-room/chat-session-activity-state";
import type { ChatMissionProgressViewModel } from "../src/components/chat-room/types/chat-mission-progress.types";
import type { ChatStreamLine } from "../src/components/chat-room/types/chat-room.types";

describe("chat session activity state", () => {
	it("groups repeated file reads into one expandable activity section", () => {
		const sections = createChatSessionActivitySections({
			missionProgress: null,
			streamLines: [
				streamLine("line-1", "cat packages/web/AGENTS.md"),
				streamLine("line-2", "sed -n 1,120p packages/web/src/page.tsx"),
			],
		});

		expect(sections).toEqual([
			{
				details: [
					{
						id: "stream:line-1:reading-files",
						text: "cat packages/web/AGENTS.md",
					},
					{
						id: "stream:line-2:reading-files",
						text: "sed -n 1,120p packages/web/src/page.tsx",
					},
				],
				id: "reading-files:reading-files",
				kind: "reading-files",
				summary: "Reading files...",
			},
		]);
	});

	it("keeps read, write, and research logs in separate summary sections", () => {
		const sections = createChatSessionActivitySections({
			missionProgress: missionWithLogs([
				{ id: "line-1", stream: "stdout", text: "rg streamLines packages/web" },
				{
					id: "line-2",
					stream: "stdout",
					text: "apply_patch chat-transcript.tsx",
				},
				{
					id: "line-3",
					stream: "stdout",
					text: "web.run search_query app router examples",
				},
			]),
			streamLines: [],
		});

		expect(
			sections.map((section) => ({
				details: section.details.map((detail) => detail.text),
				kind: section.kind,
				summary: section.summary,
			})),
		).toEqual([
			{
				details: ["rg streamLines packages/web"],
				kind: "reading-files",
				summary: "Reading files...",
			},
			{
				details: ["apply_patch chat-transcript.tsx"],
				kind: "writing",
				summary: "Writing changes...",
			},
			{
				details: ["web.run search_query app router examples"],
				kind: "browsing",
				summary: "Researching...",
			},
		]);
	});

	it("surfaces MCP activity with the plugin name when structured data has it", () => {
		const sections = createChatSessionActivitySections({
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

		expect(sections).toEqual([
			{
				details: [
					{
						id: "mission:line-1:tool",
						text: "Running mcp__github__search_issues",
					},
				],
				id: "tool:running-mcp-github",
				kind: "tool",
				summary: "Running MCP: GitHub...",
			},
		]);
	});

	it("classifies skills, docs, browsing, and coding conservatively", () => {
		expect(activitySummary("Reading skills/plan/SKILL.md")).toBe(
			"Reading skills...",
		);
		expect(activitySummary("Searching OpenAI docs for Responses API")).toBe(
			"Reading docs...",
		);
		expect(activitySummary("web.run search_query app router examples")).toBe(
			"Researching...",
		);
		expect(
			activitySummary("bun test packages/web/tests/chat-room.test.ts"),
		).toBe("Coding...");
	});

	it("suppresses unknown output and terminal mission activity", () => {
		expect(
			createChatSessionActivitySections({
				missionProgress: null,
				streamLines: [streamLine("line-1", "agent output is still warming up")],
			}),
		).toEqual([]);
		expect(
			createChatSessionActivitySections({
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

	it("hides stale activity after the testing phase is done", () => {
		expect(
			createChatSessionActivitySections({
				missionProgress: {
					...missionWithLogs([
						{
							id: "line-1",
							stream: "stdout",
							text: "bun test packages/web/tests/chat-session.test.ts",
						},
					]),
					latestResult: { label: "succeeded", tone: "success" },
					phases: [
						{ id: "plan", label: "Planning", status: "success" },
						{ id: "implement", label: "Implementing", status: "success" },
						{ id: "testing", label: "Testing", status: "success" },
					],
					status: "in_review",
				},
				streamLines: [],
			}),
		).toEqual([]);
	});

	it("keeps live stream actions visible when mission logs are terminal", () => {
		const sections = createChatSessionActivitySections({
			missionProgress: {
				...missionWithLogs(
					[
						{
							id: "line-1",
							stream: "stdout",
							text: "bun test packages/web/tests/chat-session.test.ts",
						},
					],
					"done",
				),
				phases: [
					{ id: "plan", label: "Planning", status: "success" },
					{ id: "implement", label: "Implementing", status: "success" },
					{ id: "testing", label: "Testing", status: "success" },
				],
			},
			streamLines: [
				streamLine("stream-1", "web.run search_query implementation notes"),
			],
		});

		expect(sections).toHaveLength(1);
		expect(sections[0]?.summary).toBe("Researching...");
		expect(sections[0]?.details).toEqual([
			{
				id: "stream:stream-1:browsing",
				text: "web.run search_query implementation notes",
			},
		]);
	});
});

function activitySummary(text: string): string | undefined {
	return createChatSessionActivitySections({
		missionProgress: null,
		streamLines: [streamLine("line-1", text)],
	})[0]?.summary;
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
		phaseLogLines: { plan: [], implement: [], testing: [], qa: [] },
		phases: [
			{ id: "plan", label: "Planning", status: "success" },
			{ id: "implement", label: "Implementing", status: "running" },
			{ id: "testing", label: "Testing", status: "pending" },
		],
	};
}
