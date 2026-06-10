import { describe, expect, it } from "bun:test";
import { createChatSessionActivitySections } from "../src/components/chat-room/chat-session-activity-state";
import type { ChatMissionProgressViewModel } from "../src/components/chat-room/types/chat-mission-progress.types";
import type { ChatStreamLine } from "../src/components/chat-room/types/chat-room.types";

describe("chat session activity state", () => {
	it("keeps live message stream rows out of Chat activity sections", () => {
		const sections = createChatSessionActivitySections({
			missionProgress: null,
			streamLines: [
				streamLine("line-1", "Reading files..."),
				streamLine("line-2", "Writing changes..."),
			],
		});

		expect(sections).toEqual([]);
	});

	it("keeps mission logs out of Chat activity sections", () => {
		const sections = createChatSessionActivitySections({
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

		expect(sections).toEqual([]);
	});
});

function streamLine(id: string, text: string): ChatStreamLine {
	return { id, stream: "system", text };
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
		title: "Activity task",
		status: "in_progress",
		statusLabel: "Implementing",
		updatedAt: "2026-05-29T00:00:00.000Z",
		notes: [],
		executions: [],
		latestLogLines: logs,
		latestResult: null,
		usageSummary: null,
		phaseLogLines: { plan: [], implement: [], testing: [], qa: [] },
		phases: [{ id: "implement", label: "Implementing", status: "running" }],
	};
}
