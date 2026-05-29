import {
	parseJsonRecord,
	readAllStrings,
	readStructuredToolName,
} from "./chat-session-activity-structured";
import type { ChatMissionProgressViewModel } from "./types/chat-mission-progress.types";
import type { ChatStreamLine } from "./types/chat-room.types";
import type {
	ChatSessionActivityBubble,
	ChatSessionActivityKind,
} from "./types/chat-session-activity.types";

const ACTIVE_MISSION_STATUSES = new Set(["in_progress", "in_review"]);
const LABELS: Record<Exclude<ChatSessionActivityKind, "tool">, string> = {
	browsing: "Browsing websites...",
	coding: "Coding...",
	"reading-docs": "Reading docs...",
	"reading-files": "Reading files...",
	"reading-skills": "Reading skills...",
	writing: "Writing changes...",
};

interface CreateChatSessionActivityInput {
	missionProgress: ChatMissionProgressViewModel | null;
	streamLines: ChatStreamLine[];
}

interface ActivityMatch {
	kind: ChatSessionActivityKind;
	label: string;
}

export function createChatSessionActivityBubbles({
	missionProgress,
	streamLines,
}: CreateChatSessionActivityInput): ChatSessionActivityBubble[] {
	const candidates: ChatSessionActivityBubble[] = [];
	for (const line of streamLines) {
		const activity = resolveActivity(line.text);
		if (!activity) continue;
		candidates.push({
			id: `stream:${line.id}:${activity.kind}`,
			...activity,
		});
	}
	if (isActiveMission(missionProgress)) {
		for (const line of missionProgress.latestLogLines) {
			const activity = resolveActivity(line.text);
			if (!activity) continue;
			candidates.push({
				id: `mission:${line.id}:${activity.kind}`,
				...activity,
			});
		}
	}
	const latest = candidates.at(-1);
	return latest ? [latest] : [];
}

function isActiveMission(
	missionProgress: ChatMissionProgressViewModel | null,
): missionProgress is ChatMissionProgressViewModel {
	if (!missionProgress || missionProgress.state !== "ready") return false;
	return ACTIVE_MISSION_STATUSES.has(missionProgress.status.toLowerCase());
}

function resolveActivity(text: string): ActivityMatch | null {
	const structured = resolveStructuredActivity(text);
	if (structured) return structured;
	return resolvePlainTextActivity(text);
}

function resolveStructuredActivity(text: string): ActivityMatch | null {
	const record = parseJsonRecord(text);
	if (!record) return null;
	const toolName = readStructuredToolName(record);
	if (toolName) return resolveToolActivity(toolName);
	return resolvePlainTextActivity(readAllStrings(record).join(" "));
}

function resolvePlainTextActivity(text: string): ActivityMatch | null {
	const normalized = text.toLowerCase();
	if (isSkillRead(normalized)) return labeledActivity("reading-skills");
	if (isDocsRead(normalized)) return labeledActivity("reading-docs");
	if (isBrowsing(normalized)) return labeledActivity("browsing");
	const toolName = extractToolName(normalized);
	if (toolName) return resolveToolActivity(toolName);
	if (isWriting(normalized)) return labeledActivity("writing");
	if (isFileRead(normalized)) return labeledActivity("reading-files");
	if (isCoding(normalized)) return labeledActivity("coding");
	return null;
}

function labeledActivity(
	kind: Exclude<ChatSessionActivityKind, "tool">,
): ActivityMatch {
	return { kind, label: LABELS[kind] };
}

function resolveToolActivity(toolName: string): ActivityMatch {
	const browsing = resolveToolBrowsing(toolName);
	if (browsing) return browsing;
	const pluginName = formatPluginName(readPluginName(toolName));
	if (pluginName) {
		return { kind: "tool", label: `Running MCP: ${pluginName}...` };
	}
	return { kind: "tool", label: "Running tool..." };
}

function resolveToolBrowsing(toolName: string): ActivityMatch | null {
	const normalized = toolName.toLowerCase();
	if (
		normalized.includes("browser") ||
		normalized.includes("web.") ||
		normalized.includes("web_")
	) {
		return labeledActivity("browsing");
	}
	return null;
}

function isSkillRead(text: string): boolean {
	return (
		text.includes("/skill.md") ||
		text.includes("skills/") ||
		text.includes(" skill")
	);
}

function isDocsRead(text: string): boolean {
	return (
		text.includes(" docs") ||
		text.includes("docs/") ||
		text.includes("documentation") ||
		text.includes("readme")
	);
}

function isBrowsing(text: string): boolean {
	return (
		text.includes("web.run") ||
		text.includes("search_query") ||
		text.includes("browser") ||
		text.includes("website") ||
		text.includes("http://") ||
		text.includes("https://")
	);
}

function isWriting(text: string): boolean {
	return (
		text.includes("apply_patch") ||
		text.includes("writefile") ||
		text.includes("write_file") ||
		text.includes(" patch") ||
		text.includes(" edit") ||
		text.includes(" save") ||
		text.includes("created file") ||
		text.includes("updated file")
	);
}

function isFileRead(text: string): boolean {
	return (
		/(^|\s)(cat|sed|rg|ls|find|open)\s/.test(text) ||
		text.includes("readfile") ||
		text.includes("read_file") ||
		text.includes("reading file")
	);
}

function isCoding(text: string): boolean {
	return (
		text.includes("bun test") ||
		text.includes("bun run") ||
		text.includes("typecheck") ||
		text.includes("build") ||
		text.includes("implement") ||
		text.includes("coding") ||
		text.includes(".tsx") ||
		text.includes("typescript")
	);
}

function extractToolName(text: string): string | null {
	if (text.includes("mcp__")) return text.match(/mcp__[^\s"']+/)?.[0] ?? null;
	if (text.includes("tool_call") || text.includes("recipient_name")) {
		return text.match(/[a-z0-9_-]+(?:[.:_]{1,2}[a-z0-9_-]+)+/)?.[0] ?? null;
	}
	return null;
}

function readPluginName(toolName: string): string | null {
	const mcpMatch = toolName.match(/^mcp__([^_]+(?:_[^_]+)*)__/i);
	if (mcpMatch?.[1]) return mcpMatch[1];
	const dottedMatch = toolName.match(/^([a-z][a-z0-9_-]*)[.:]/i);
	return dottedMatch?.[1] ?? null;
}

function formatPluginName(rawName: string | null): string | null {
	if (!rawName) return null;
	const lower = rawName.toLowerCase();
	const special: Record<string, string> = {
		codegraph: "CodeGraph",
		github: "GitHub",
		gmail: "Gmail",
		openai: "OpenAI",
	};
	if (special[lower]) return special[lower];
	return rawName
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}
