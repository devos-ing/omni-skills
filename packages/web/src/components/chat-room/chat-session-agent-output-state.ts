import type { ChatMessageRecord } from "@/lib/api";

import { parseJsonRecord } from "./chat-session-activity-structured";
import type {
	ChatMissionLogLine,
	ChatMissionProgressViewModel,
} from "./types/chat-mission-progress.types";
import type { ChatStreamLine } from "./types/chat-room.types";
import type { ChatSessionAgentOutput } from "./types/chat-session-agent-output.types";

const AGENT_PREFIX = /^\s*(assistant|codex|agent)\s*:\s*/i;
const AGENT_OUTPUT_PREFIX = /^\s*(?:agent\s+)?output\s*:\s*/i;
const MAX_AGENT_OUTPUTS = 6;
const SAFE_STRUCTURED_OUTPUT_FIELDS = ["text", "message", "detail", "summary"];
const WORKFLOW_STREAM_SCHEMA_PREFIX = "devos.workflow.stream.";

interface CreateChatSessionAgentOutputInput {
	messages: ChatMessageRecord[];
	missionProgress: ChatMissionProgressViewModel | null;
	planMessageContent: string | null;
	streamLines: ChatStreamLine[];
}

export function createChatSessionAgentOutputs({
	messages,
	missionProgress,
	planMessageContent,
	streamLines,
}: CreateChatSessionAgentOutputInput): ChatSessionAgentOutput[] {
	const suppressed = new Set(
		messages
			.filter((message) => message.role === "assistant")
			.map((message) => normalizeOutputText(message.content)),
	);
	if (planMessageContent) {
		suppressed.add(normalizeOutputText(planMessageContent));
	}
	const outputs: ChatSessionAgentOutput[] = [];
	const seen = new Set<string>();
	for (const line of missionLogLines(missionProgress)) {
		addAgentOutput(outputs, seen, suppressed, `mission:${line.id}`, line.text);
	}
	for (const line of streamLines) {
		addStreamOutput(outputs, seen, suppressed, line);
	}
	return outputs.slice(-MAX_AGENT_OUTPUTS);
}

function missionLogLines(
	missionProgress: ChatMissionProgressViewModel | null,
): ChatMissionLogLine[] {
	if (!missionProgress || missionProgress.state !== "ready") return [];
	const executionLines = missionProgress.executions.flatMap(
		(execution) => execution.logLines,
	);
	return executionLines.length > 0
		? executionLines
		: missionProgress.latestLogLines;
}

function addAgentOutput(
	outputs: ChatSessionAgentOutput[],
	seen: Set<string>,
	suppressed: Set<string>,
	id: string,
	rawText: string,
): void {
	const text = readAgentOutputText(rawText);
	if (!text) return;
	const normalized = normalizeOutputText(text);
	if (!normalized || suppressed.has(normalized) || seen.has(normalized)) return;
	seen.add(normalized);
	outputs.push({ id, text });
}

function addStreamOutput(
	outputs: ChatSessionAgentOutput[],
	seen: Set<string>,
	suppressed: Set<string>,
	line: ChatStreamLine,
): void {
	const text = readStreamOutputText(line);
	if (!text) return;
	const normalized = normalizeOutputText(text);
	if (!normalized || suppressed.has(normalized) || seen.has(normalized)) return;
	seen.add(normalized);
	outputs.push({ id: `stream:${line.id}`, text });
}

function readStreamOutputText(line: ChatStreamLine): string | null {
	const structured = readStructuredAgentOutput(line.text);
	if (structured) return structured;
	if (parseJsonRecord(line.text)) return null;
	if (line.stream === "system") {
		return line.text.trim() || null;
	}
	return readAgentOutputText(line.text);
}

function readAgentOutputText(rawText: string): string | null {
	const structured = readStructuredAgentOutput(rawText);
	if (structured) return structured;
	const text = rawText
		.replace(AGENT_OUTPUT_PREFIX, "")
		.replace(AGENT_PREFIX, "")
		.trim();
	if (text === rawText.trim()) return null;
	return text || null;
}

function readStructuredAgentOutput(rawText: string): string | null {
	const record = parseJsonRecord(rawText);
	if (!record) return null;
	const directType = readString(record, "type")?.toLowerCase();
	if (directType === "agent_message") {
		return readSafeStructuredOutputText(record, "text");
	}
	const item = readRecord(record, "item");
	if (item) {
		const itemType = readString(item, "type")?.toLowerCase();
		if (itemType === "agent_message") {
			return readSafeStructuredOutputText(item, "text");
		}
	}
	if (!isWorkflowStreamRecord(record)) return null;
	return readSafeStructuredOutputText(record);
}

function isWorkflowStreamRecord(record: Record<string, unknown>): boolean {
	const schema = readString(record, "schema");
	if (schema?.startsWith(WORKFLOW_STREAM_SCHEMA_PREFIX)) return true;
	const kind = readString(record, "kind")?.toLowerCase();
	return kind === "thinking" || kind === "action" || kind === "output";
}

function readSafeStructuredOutputText(
	record: Record<string, unknown>,
	preferredField?: string,
): string | null {
	const fields = preferredField
		? [preferredField, ...SAFE_STRUCTURED_OUTPUT_FIELDS]
		: SAFE_STRUCTURED_OUTPUT_FIELDS;
	for (const field of fields) {
		const value = readTrimmedString(record, field);
		if (value) return value;
	}
	return null;
}

function readRecord(
	record: Record<string, unknown>,
	key: string,
): Record<string, unknown> | null {
	const value = record[key];
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function readString(
	record: Record<string, unknown>,
	key: string,
): string | null {
	const value = record[key];
	return typeof value === "string" ? value : null;
}

function readTrimmedString(
	record: Record<string, unknown>,
	key: string,
): string | null {
	const value = readString(record, key)?.trim();
	return value || null;
}

function normalizeOutputText(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}
