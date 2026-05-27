import type {
	ChatMissionLogSummaryGroup,
	ChatMissionLogSummarySource,
} from "./types/chat-mission-log-summary.types";
import type { ChatMissionLogLine } from "./types/chat-mission-progress.types";

const SOURCE_ORDER: ChatMissionLogSummarySource[] = [
	"user",
	"assistant",
	"agent",
	"error",
	"system",
];

const SOURCE_LABELS: Record<ChatMissionLogSummarySource, string> = {
	agent: "Agent",
	assistant: "Assistant",
	error: "Error",
	system: "System",
	user: "User",
};

const SOURCE_PREFIX = /^\s*(assistant|codex|human|user)\s*:\s*/i;

export function summarizeMissionLogLines(
	lines: ChatMissionLogLine[],
): ChatMissionLogSummaryGroup[] {
	const groups = new Map<
		ChatMissionLogSummarySource,
		ChatMissionLogSummaryGroup
	>();
	for (const line of lines) {
		const structuredMessage = readStructuredMissionMessage(line.text);
		const source = structuredMessage?.source ?? resolveMissionLogSource(line);
		const group = ensureSummaryGroup(groups, source);
		group.lines.push(line);
		group.lineCount = group.lines.length;
		group.latestSnippet = formatMissionLogSnippet(
			structuredMessage?.text ?? line.text,
		);
	}
	return SOURCE_ORDER.map((source) => groups.get(source)).filter(
		(group): group is ChatMissionLogSummaryGroup => Boolean(group),
	);
}

function ensureSummaryGroup(
	groups: Map<ChatMissionLogSummarySource, ChatMissionLogSummaryGroup>,
	source: ChatMissionLogSummarySource,
): ChatMissionLogSummaryGroup {
	const existing = groups.get(source);
	if (existing) return existing;
	const group: ChatMissionLogSummaryGroup = {
		id: source,
		label: SOURCE_LABELS[source],
		latestSnippet: "",
		lineCount: 0,
		lines: [],
	};
	groups.set(source, group);
	return group;
}

function resolveMissionLogSource(
	line: ChatMissionLogLine,
): ChatMissionLogSummarySource {
	const match = line.text.match(SOURCE_PREFIX);
	if (match) {
		const prefix = match[1]?.toLowerCase();
		if (prefix === "assistant" || prefix === "codex") return "assistant";
		return "user";
	}
	if (line.stream === "stderr") return "error";
	if (line.stream === "system") return "system";
	return "agent";
}

function readStructuredMissionMessage(
	text: string,
): { source: ChatMissionLogSummarySource; text: string } | null {
	try {
		const parsed = JSON.parse(text) as unknown;
		const item = recordValue(parsed, "item");
		const itemType = recordValue(item, "type");
		const itemText = recordValue(item, "text");
		if (typeof itemText !== "string" || !itemText.trim()) return null;
		if (itemType === "agent_message") {
			return { source: "assistant", text: itemText };
		}
		if (itemType === "user_message") {
			return { source: "user", text: itemText };
		}
	} catch {
		return null;
	}
	return null;
}

function recordValue(value: unknown, key: string): unknown {
	if (!value || typeof value !== "object") return undefined;
	return (value as Record<string, unknown>)[key];
}

function formatMissionLogSnippet(text: string): string {
	const compact = text.replace(SOURCE_PREFIX, "").replace(/\s+/g, " ").trim();
	if (compact.length <= 120) return compact;
	return `${compact.slice(0, 117)}...`;
}
