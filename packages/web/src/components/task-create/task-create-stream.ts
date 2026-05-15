import type { TaskCreateAnswer, TaskCreateResponse } from "@/lib/api";
import { createWebApiClient } from "@/lib/api/web-client";

export interface StreamTaskCreateInput {
	request: string;
	projectId: string;
	answers?: TaskCreateAnswer[];
	onLog: (stream: "stdout" | "stderr" | "system", text: string) => void;
}

export async function streamTaskCreate(
	input: StreamTaskCreateInput,
): Promise<TaskCreateResponse> {
	const apiClient = createWebApiClient();
	input.onLog("system", "Creating Linear issue and board task.");
	return apiClient.createTask({
		request: input.request,
		projectId: input.projectId,
		answers: input.answers,
	});
}
