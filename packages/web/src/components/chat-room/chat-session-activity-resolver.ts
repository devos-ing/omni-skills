import {
	parseJsonRecord,
	readAllStrings,
	readStructuredToolName,
} from "./chat-session-activity-structured";
import type {
	ChatSessionActivityKind,
	ChatSessionActivityMatch,
} from "./types/chat-session-activity.types";

const SUMMARIES: Record<Exclude<ChatSessionActivityKind, "tool">, string> = {
	browsing: "Researching...",
	coding: "Coding...",
	"reading-docs": "Reading docs...",
	"reading-files": "Reading files...",
	"reading-skills": "Reading skills...",
	writing: "Writing changes...",
};

export function resolveSessionActivity(
	text: string,
): ChatSessionActivityMatch | null {
	const structured = resolveStructuredActivity(text);
	if (structured) return structured;
	return resolvePlainTextActivity(text);
}

function resolveStructuredActivity(
	text: string,
): ChatSessionActivityMatch | null {
	const record = parseJsonRecord(text);
	if (!record) return null;
	const toolName = readStructuredToolName(record);
	if (toolName) return resolveToolActivity(toolName);
	const detailText = readAllStrings(record).join(" ").trim();
	if (!detailText) return null;
	return resolvePlainTextActivity(detailText);
}

function resolvePlainTextActivity(
	text: string,
): ChatSessionActivityMatch | null {
	const detailText = text.trim();
	if (!detailText) return null;
	const normalized = detailText.toLowerCase();
	if (isSkillRead(normalized))
		return labeledActivity("reading-skills", detailText);
	if (isDocsRead(normalized))
		return labeledActivity("reading-docs", detailText);
	if (isBrowsing(normalized)) return labeledActivity("browsing", detailText);
	const toolName = extractToolName(detailText);
	if (toolName) return resolveToolActivity(toolName);
	if (isWriting(normalized)) return labeledActivity("writing", detailText);
	if (isFileRead(normalized))
		return labeledActivity("reading-files", detailText);
	if (isCoding(normalized)) return labeledActivity("coding", detailText);
	return null;
}

function labeledActivity(
	kind: Exclude<ChatSessionActivityKind, "tool">,
	detailText: string,
): ChatSessionActivityMatch {
	return { detailText, kind, summary: SUMMARIES[kind] };
}

function resolveToolActivity(toolName: string): ChatSessionActivityMatch {
	const browsing = resolveToolBrowsing(toolName);
	if (browsing) return browsing;
	const pluginName = formatPluginName(readPluginName(toolName));
	return {
		detailText: `Running ${toolName}`,
		kind: "tool",
		summary: pluginName ? `Running MCP: ${pluginName}...` : "Running tool...",
	};
}

function resolveToolBrowsing(
	toolName: string,
): ChatSessionActivityMatch | null {
	const normalized = toolName.toLowerCase();
	if (
		normalized.includes("browser") ||
		normalized.includes("web.") ||
		normalized.includes("web_")
	) {
		return labeledActivity("browsing", `Running ${toolName}`);
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
		return text.match(/[a-z0-9_-]+(?:[.:_]{1,2}[a-z0-9_-]+)+/i)?.[0] ?? null;
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
