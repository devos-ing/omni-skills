import type {
	CliDispatchStreamEvent,
	TaskCreateAnswer,
	TaskCreateResponse,
} from "@/lib/api";
import { parseTaskCreateDispatchResult } from "@/lib/api/task-client";
import { createWebApiClient } from "@/lib/api/web-client";

export interface StreamTaskCreateInput {
	request: string;
	projectId?: string;
	answers?: TaskCreateAnswer[];
	onLog: (stream: "stdout" | "stderr", text: string) => void;
}

export async function streamTaskCreate(
	input: StreamTaskCreateInput,
): Promise<TaskCreateResponse> {
	const apiClient = createWebApiClient();
	let result: TaskCreateResponse | undefined;
	await apiClient.streamCliDispatch(
		{
			action: "task",
			taskAction: "create",
			request: input.request,
			projectId: input.projectId,
			clarificationAnswers: input.answers,
		},
		(event) => {
			if (event.type === "stdout" || event.type === "stderr") {
				input.onLog(event.type, event.text);
				return;
			}
			if (event.type === "error") {
				result = { status: "error", error: event.error, rawOutput: "" };
				return;
			}
			result = parseCompleteEvent(event) ?? result;
		},
	);
	return (
		result ?? {
			status: "error",
			error: "Task create stream completed without a result",
			rawOutput: "",
		}
	);
}

function parseCompleteEvent(
	event: CliDispatchStreamEvent,
): TaskCreateResponse | undefined {
	if (event.type !== "complete") {
		return undefined;
	}
	return parseTaskCreateDispatchResult(event.result);
}
