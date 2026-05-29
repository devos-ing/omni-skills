import type { ChatMessageRecord } from "@/lib/api";
import { isPlanContent } from "./chat-message-display";
import type { ChatMissionProgressViewModel } from "./types/chat-mission-progress.types";

const STREAM_CHUNK_MARKER = /^\[devos-event:[^\]]+\]$/;
const STREAM_LINE_PREFIX = /^\[([^\]\s]+)\s+(stdout|stderr)\]\s?/;

export function resolveMissionPlanMessageContent(
	mission: ChatMissionProgressViewModel | null,
	messages: ChatMessageRecord[],
): string | null {
	if (!mission || !isPlanningComplete(mission)) return null;
	const planContent = latestMissionPlanContent(mission);
	if (!planContent || hasMatchingAssistantMessage(messages, planContent)) {
		return null;
	}
	return planContent;
}

function isPlanningComplete(mission: ChatMissionProgressViewModel): boolean {
	return mission.phases.some(
		(phase) => phase.id === "plan" && phase.status === "success",
	);
}

function latestMissionPlanContent(
	mission: ChatMissionProgressViewModel,
): string | null {
	const candidates = mission.executions.flatMap((execution) =>
		streamChunksFromExecutionBody(execution.body),
	);
	const plan = candidates
		.filter((content) => isPlanContent(content))
		.at(-1)
		?.trim();
	if (plan) return plan;
	const phasePlan = mission.phaseLogLines.plan
		.map((line) => line.text)
		.join("\n")
		.trim();
	return isPlanContent(phasePlan) ? phasePlan : null;
}

function streamChunksFromExecutionBody(body: string): string[] {
	const chunks: string[] = [];
	let current: string[] = [];
	for (const line of body.split(/\r?\n/)) {
		if (STREAM_CHUNK_MARKER.test(line)) {
			pushStreamChunk(chunks, current);
			current = [];
			continue;
		}
		current.push(line);
	}
	pushStreamChunk(chunks, current);
	return chunks;
}

function pushStreamChunk(chunks: string[], lines: string[]): void {
	if (lines.length === 0) return;
	const [firstLine = "", ...rest] = lines;
	const match = firstLine.match(STREAM_LINE_PREFIX);
	if (match?.[2] === "stderr") return;
	const firstText = match
		? firstLine.replace(STREAM_LINE_PREFIX, "")
		: firstLine;
	const content = [firstText, ...rest].join("\n").trim();
	if (content) chunks.push(content);
}

function hasMatchingAssistantMessage(
	messages: ChatMessageRecord[],
	content: string,
): boolean {
	const normalizedContent = normalizePlanContent(content);
	return messages.some(
		(message) =>
			message.role === "assistant" &&
			normalizePlanContent(message.content) === normalizedContent,
	);
}

function normalizePlanContent(content: string): string {
	return content.replace(/\s+/g, " ").trim();
}
