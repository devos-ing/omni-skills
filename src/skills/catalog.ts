import { Database } from "bun:sqlite";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { IssueRef, ResolvedProjectConfig } from "../core/types";
import {
	clampText,
	collectSkillFiles,
	dedupeCandidates,
	parseSkillDocument,
	parseTags,
	sourcePriority,
	tokenize,
} from "./catalog-helpers";
import type {
	RankedSkillCandidate,
	SkillCandidate,
	SkillSelectionResult,
} from "./types";

export type {
	RankedSkillCandidate,
	SkillCandidate,
	SkillSelectionResult,
} from "./types";

const MAX_SKILL_CONTENT_CHARS = 4000;

interface DatabaseSkillRow {
	name: string;
	description: string | null;
	content: string | null;
	path: string | null;
	tags: string | null;
}

export async function selectPlanningSupplementalSkills(
	config: ResolvedProjectConfig,
	issue: IssueRef,
): Promise<SkillSelectionResult> {
	const autoSelect = config.skills.autoSelect;
	if (!autoSelect?.enabled) {
		return { selected: [], warnings: [] };
	}

	const warnings: string[] = [];
	let candidates: SkillCandidate[] = [];

	if (autoSelect.sources.folder) {
		try {
			const fromFolder = await loadFolderSkillCandidates(
				config.skills.root,
				config.skills.plan,
			);
			candidates = candidates.concat(fromFolder);
		} catch (error) {
			warnings.push(
				`Folder skill source failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	if (autoSelect.sources.database) {
		try {
			const fromDatabase = await loadDatabaseSkillCandidates(
				autoSelect.databasePath,
			);
			candidates = candidates.concat(fromDatabase);
		} catch (error) {
			warnings.push(
				`Database skill source failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	const selected = rankSkillCandidates(
		candidates,
		issue,
		autoSelect.maxSelected,
	);
	return { selected, warnings };
}

export async function loadFolderSkillCandidates(
	root: string,
	basePlanSkillPath?: string,
): Promise<SkillCandidate[]> {
	const normalizedRoot = path.resolve(root);
	await access(normalizedRoot);
	const files = await collectSkillFiles(normalizedRoot);
	const normalizedBasePlanPath = basePlanSkillPath
		? path.resolve(basePlanSkillPath)
		: undefined;
	const candidates: SkillCandidate[] = [];
	for (const filePath of files) {
		if (
			normalizedBasePlanPath &&
			path.resolve(filePath) === normalizedBasePlanPath
		) {
			continue;
		}
		const raw = await readFile(filePath, "utf8");
		const parsed = parseSkillDocument(raw);
		candidates.push({
			name:
				parsed.name ??
				path.basename(path.dirname(filePath)).replace(/[-_]+/g, " ").trim(),
			description: parsed.description,
			content: clampText(raw, MAX_SKILL_CONTENT_CHARS),
			path: filePath,
			tags: [],
			source: "folder",
		});
	}
	return candidates;
}

export function loadDatabaseSkillCandidates(
	databasePath: string | undefined,
): SkillCandidate[] {
	if (!databasePath) {
		throw new Error(
			"databasePath is required when skills.autoSelect.sources.database is enabled.",
		);
	}

	const resolvedPath = path.resolve(databasePath);
	const db = new Database(resolvedPath, { readonly: true, create: false });
	try {
		const rows = db
			.query(
				"SELECT name, description, content, path, tags FROM skills WHERE name IS NOT NULL AND TRIM(name) != ''",
			)
			.all() as DatabaseSkillRow[];
		return rows.map((row) => ({
			name: row.name.trim(),
			description: row.description?.trim() || undefined,
			content: row.content?.trim() || undefined,
			path: row.path?.trim() || undefined,
			tags: parseTags(row.tags),
			source: "database",
		}));
	} catch (error) {
		throw new Error(
			`Failed to read skills table from '${resolvedPath}'. Expected schema: skills(name, description, content, path, tags). ${error instanceof Error ? error.message : String(error)}`,
		);
	} finally {
		db.close(false);
	}
}

export function rankSkillCandidates(
	candidates: SkillCandidate[],
	issue: IssueRef,
	maxSelected: number,
): RankedSkillCandidate[] {
	if (candidates.length === 0) {
		return [];
	}

	const queryTokens = tokenize(
		[issue.key, issue.title, issue.description].join(" "),
	);
	if (queryTokens.size === 0) {
		return [];
	}

	const deduped = dedupeCandidates(candidates);
	const scored: RankedSkillCandidate[] = deduped
		.map((candidate) => ({
			...candidate,
			score: scoreCandidate(candidate, queryTokens),
		}))
		.filter((candidate) => candidate.score > 0)
		.sort((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			const sourceOrder = sourcePriority(a.source) - sourcePriority(b.source);
			if (sourceOrder !== 0) {
				return sourceOrder;
			}
			return a.name.localeCompare(b.name);
		});

	const limit =
		Number.isInteger(maxSelected) && maxSelected > 0 ? maxSelected : 3;
	return scored.slice(0, limit);
}

function scoreCandidate(
	candidate: SkillCandidate,
	queryTokens: Set<string>,
): number {
	const nameTokens = tokenize(candidate.name);
	const descriptionTokens = tokenize(candidate.description ?? "");
	const tagTokens = tokenize(candidate.tags.join(" "));
	const contentTokens = tokenize(candidate.content ?? "");
	const pathTokens = tokenize(candidate.path ?? "");

	let score = 0;
	score += overlapSize(queryTokens, nameTokens) * 4;
	score += overlapSize(queryTokens, descriptionTokens) * 3;
	score += overlapSize(queryTokens, tagTokens) * 2;
	score += overlapSize(queryTokens, contentTokens);
	score += overlapSize(queryTokens, pathTokens);
	return score;
}

function overlapSize(a: Set<string>, b: Set<string>): number {
	let count = 0;
	for (const token of a) {
		if (b.has(token)) {
			count += 1;
		}
	}
	return count;
}
