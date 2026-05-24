import { readdir } from "node:fs/promises";
import path from "node:path";
import type { SkillCandidate, SkillSource } from "./types";

const STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"by",
	"for",
	"from",
	"in",
	"is",
	"it",
	"of",
	"on",
	"or",
	"that",
	"the",
	"to",
	"with",
	"workflow",
	"agent",
	"issue",
]);

export function sourcePriority(source: SkillSource): number {
	if (source === "folder") return 0;
	if (source === "plugin") return 1;
	return 2;
}

export function dedupeCandidates(
	candidates: SkillCandidate[],
): SkillCandidate[] {
	const selectedByName = new Map<string, SkillCandidate>();
	for (const candidate of candidates) {
		const key = candidate.name.trim().toLowerCase();
		if (!key) {
			continue;
		}
		const existing = selectedByName.get(key);
		if (!existing) {
			selectedByName.set(key, candidate);
			continue;
		}
		if (sourcePriority(candidate.source) < sourcePriority(existing.source)) {
			selectedByName.set(key, candidate);
			continue;
		}
		if (
			candidate.source === existing.source &&
			(candidate.description?.length ?? 0) > (existing.description?.length ?? 0)
		) {
			selectedByName.set(key, candidate);
		}
	}
	return Array.from(selectedByName.values());
}

export function parseSkillDocument(input: string): {
	name?: string;
	description?: string;
} {
	const nameMatch = input.match(/^name:\s*(.+)$/im);
	const descriptionMatch = input.match(/^description:\s*(.+)$/im);
	return {
		name: nameMatch?.[1]?.trim() || undefined,
		description: descriptionMatch?.[1]?.trim() || undefined,
	};
}

export function parseTags(raw: string | null): string[] {
	if (!raw || !raw.trim()) {
		return [];
	}
	const trimmed = raw.trim();
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		try {
			const parsed = JSON.parse(trimmed) as unknown;
			if (Array.isArray(parsed)) {
				return parsed
					.filter((item): item is string => typeof item === "string")
					.map((item) => item.trim())
					.filter(Boolean);
			}
		} catch {}
	}
	return trimmed
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

export async function collectSkillFiles(root: string): Promise<string[]> {
	const files: string[] = [];
	const entries = await readdir(root, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(root, entry.name);
		if (entry.isDirectory()) {
			const nested = await collectSkillFiles(fullPath);
			files.push(...nested);
			continue;
		}
		if (entry.isFile() && entry.name === "SKILL.md") {
			files.push(fullPath);
		}
	}
	return files;
}

export function tokenize(input: string): Set<string> {
	const normalized = input.toLowerCase().replace(/[^a-z0-9]+/g, " ");
	const tokens = normalized
		.split(/\s+/)
		.map((token) => token.trim())
		.filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
	return new Set(tokens);
}

export function clampText(input: string, limit: number): string {
	const trimmed = input.trim();
	if (trimmed.length <= limit) {
		return trimmed;
	}
	return `${trimmed.slice(0, limit)}\n...[truncated]`;
}
