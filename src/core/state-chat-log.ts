import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentChatLogEntry } from "./types";

const STATE_ROOT_DIR = path.join(".piv-loop", "projects");
const CHAT_LOGS_DIR = "chat-logs";
export const AGENT_CHAT_LOG_RETENTION = 1000;

function sanitizePathToken(value: string): string {
	const cleaned = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return cleaned || "default";
}

function skillPathHash(skillPath: string): string {
	return createHash("sha1").update(skillPath).digest("hex").slice(0, 8);
}

function agentSkillLogFileName(skillPath: string): string {
	const normalized = sanitizePathToken(skillPath.replace(/[\\/]+/g, "-"));
	return `${normalized}-${skillPathHash(skillPath)}.json`;
}

export function agentChatLogPath(
	cwd: string,
	projectId: string,
	agentRole: AgentChatLogEntry["agentRole"],
	skillPath: string,
): string {
	return path.join(
		cwd,
		STATE_ROOT_DIR,
		projectId,
		CHAT_LOGS_DIR,
		sanitizePathToken(agentRole),
		agentSkillLogFileName(skillPath),
	);
}

export async function appendAgentChatLog(
	cwd: string,
	projectId: string,
	entry: AgentChatLogEntry,
	retention = AGENT_CHAT_LOG_RETENTION,
): Promise<void> {
	const file = agentChatLogPath(
		cwd,
		projectId,
		entry.agentRole,
		entry.skillPath,
	);
	await mkdir(path.dirname(file), { recursive: true });

	let existing: AgentChatLogEntry[] = [];
	try {
		const raw = await readFile(file, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		if (Array.isArray(parsed)) {
			existing = parsed as AgentChatLogEntry[];
		}
	} catch {}

	existing.push(entry);
	const keep = Math.max(1, retention);
	const trimmed = existing.slice(-keep);
	await writeFile(file, `${JSON.stringify(trimmed, null, 2)}\n`, "utf8");
}
