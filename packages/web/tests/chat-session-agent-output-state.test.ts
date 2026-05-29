import { describe, expect, it } from "bun:test";
import { createChatSessionAgentOutputs } from "../src/components/chat-room/chat-session-agent-output-state";
import type { ChatMissionProgressViewModel } from "../src/components/chat-room/types/chat-mission-progress.types";
import type { ChatStreamLine } from "../src/components/chat-room/types/chat-room.types";

describe("chat session agent output state", () => {
	it("surfaces structured agent messages as transcript output", () => {
		const outputs = createChatSessionAgentOutputs({
			messages: [],
			missionProgress: missionWithLogs([
				{
					id: "line-1",
					stream: "stdout",
					text: JSON.stringify({
						type: "item.completed",
						item: {
							type: "agent_message",
							text: "I checked the chat flow and found the output surface.",
						},
					}),
				},
			]),
			planMessageContent: null,
			streamLines: [],
		});

		expect(outputs).toEqual([
			{
				id: "mission:line-1",
				text: "I checked the chat flow and found the output surface.",
			},
		]);
	});

	it("uses live stream agent output before mission activity refreshes", () => {
		const outputs = createChatSessionAgentOutputs({
			messages: [],
			missionProgress: null,
			planMessageContent: null,
			streamLines: [
				streamLine("line-1", "Codex: Moving the output into the transcript."),
			],
		});

		expect(outputs).toEqual([
			{
				id: "stream:line-1",
				text: "Moving the output into the transcript.",
			},
		]);
	});

	it("suppresses tool logs and duplicate durable assistant content", () => {
		const outputs = createChatSessionAgentOutputs({
			messages: [
				{
					id: "message-1",
					commandAction: null,
					content: "Already saved as a chat reply.",
					createdAt: "2026-05-29T00:00:00.000Z",
					kind: "message",
					metadata: null,
					role: "assistant",
					sessionId: "session-1",
					taskId: null,
				},
			],
			missionProgress: missionWithLogs([
				{ id: "line-1", stream: "stdout", text: "apply_patch chat.tsx" },
				{
					id: "line-2",
					stream: "stdout",
					text: "Assistant: Already saved as a chat reply.",
				},
				{
					id: "line-3",
					stream: "stdout",
					text: "Agent: New transcript-only update.",
				},
			]),
			planMessageContent: "Plan content already rendered.",
			streamLines: [
				streamLine("line-4", "Assistant: Plan content already rendered."),
			],
		});

		expect(outputs).toEqual([
			{
				id: "mission:line-3",
				text: "New transcript-only update.",
			},
		]);
	});
});

function streamLine(id: string, text: string): ChatStreamLine {
	return { id, stream: "stdout", text };
}

function missionWithLogs(
	logs: Array<{
		id: string;
		stream: "stdout" | "stderr" | "system";
		text: string;
	}>,
): ChatMissionProgressViewModel {
	return {
		state: "ready",
		taskId: "task-1",
		taskKey: "TASK-1",
		title: "Agent output task",
		status: "in_progress",
		statusLabel: "Implementing",
		updatedAt: "2026-05-29T00:00:00.000Z",
		notes: [],
		executions: [],
		latestLogLines: logs,
		latestResult: null,
		usageSummary: null,
		phaseLogLines: { plan: [], implement: [], testing: [], qa: [] },
		phases: [],
	};
}
