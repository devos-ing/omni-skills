import type { TaskCreateResponse } from "@/lib/api";

export function formatTaskCreateError(
	response: Exclude<TaskCreateResponse, { status: "created" | "needs_info" }>,
): string {
	return `Board task creation failed: ${response.error}`;
}
