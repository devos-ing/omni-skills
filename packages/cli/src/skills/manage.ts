import {
	access,
	mkdir,
	readFile,
	readdir,
	rm,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { parseSkillDocument, renderSkillDocument } from "./manage-document";
import type { ListedSkill, SkillDocumentParts } from "./types";

export type { ListedSkill, SkillDocumentParts } from "./types";

export async function listSkills(skillsRoot: string): Promise<ListedSkill[]> {
	const root = path.resolve(skillsRoot);
	try {
		await access(root);
	} catch {
		return [];
	}

	const entries = await readdir(root, { withFileTypes: true });
	const skills: ListedSkill[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}
		const skillDir = assertPathWithinRoot(root, path.join(root, entry.name));
		const skillFile = path.join(skillDir, "SKILL.md");
		try {
			const raw = await readFile(skillFile, "utf8");
			const parsed = parseSkillDocument(raw);
			skills.push({
				name: entry.name,
				path: skillFile,
				title: parsed.title || entry.name,
				description: parsed.description,
			});
		} catch {}
	}

	skills.sort((a, b) => a.name.localeCompare(b.name));
	return skills;
}

export async function addSkill(
	skillsRoot: string,
	input: SkillDocumentParts,
): Promise<{ name: string; path: string }> {
	const root = path.resolve(skillsRoot);
	await mkdir(root, { recursive: true });

	const normalized = normalizeNewSkillInput(input);
	const name = normalizeSkillName(normalized.title);
	const skillDir = assertPathWithinRoot(root, path.join(root, name));
	const skillFile = path.join(skillDir, "SKILL.md");

	try {
		await access(skillDir);
		throw new Error(`Skill '${name}' already exists`);
	} catch (error) {
		if (!isNotFoundError(error)) {
			throw error;
		}
	}

	await mkdir(skillDir, { recursive: true });
	await writeFile(skillFile, renderSkillDocument(normalized), "utf8");
	return { name, path: skillFile };
}

export async function updateSkill(
	skillsRoot: string,
	nameOrAlias: string,
	updates: Partial<SkillDocumentParts>,
): Promise<{ name: string; path: string }> {
	const root = path.resolve(skillsRoot);
	const skillDir = await resolveExistingSkillDir(root, nameOrAlias);
	const skillFile = path.join(skillDir, "SKILL.md");
	const existing = parseSkillDocument(await readFile(skillFile, "utf8"));

	const title =
		updates.title?.trim() || existing.title || path.basename(skillDir);
	const description = updates.description?.trim() ?? existing.description;
	const content = updates.content ?? existing.content;

	await writeFile(
		skillFile,
		renderSkillDocument({ title, description, content }, existing.format),
		"utf8",
	);

	return { name: path.basename(skillDir), path: skillFile };
}

export async function removeSkill(
	skillsRoot: string,
	nameOrAlias: string,
): Promise<{ name: string; path: string }> {
	const root = path.resolve(skillsRoot);
	const skillDir = await resolveExistingSkillDir(root, nameOrAlias);
	await rm(skillDir, { recursive: true, force: false });
	return { name: path.basename(skillDir), path: skillDir };
}

function normalizeNewSkillInput(input: SkillDocumentParts): SkillDocumentParts {
	const title = input.title.trim();
	const description = input.description.trim();
	const content = input.content.trim();
	if (!title) {
		throw new Error("Skill title cannot be empty");
	}
	if (!description) {
		throw new Error("Skill description cannot be empty");
	}
	if (!content) {
		throw new Error("Skill content cannot be empty");
	}
	return { title, description, content };
}

function normalizeSkillName(raw: string): string {
	const normalized = raw
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
	if (!normalized) {
		throw new Error(`Invalid skill name: '${raw}'`);
	}
	return normalized;
}

function normalizeExistingSkillLookup(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) {
		throw new Error("Skill name cannot be empty");
	}
	if (
		trimmed.includes("/") ||
		trimmed.includes("\\") ||
		trimmed.includes("..")
	) {
		throw new Error(`Invalid skill name: '${raw}'`);
	}
	return normalizeSkillName(trimmed);
}

async function resolveExistingSkillDir(
	root: string,
	nameOrAlias: string,
): Promise<string> {
	const trimmed = nameOrAlias.trim();
	const candidates = Array.from(
		new Set([trimmed, normalizeExistingSkillLookup(nameOrAlias)]),
	);
	for (const candidate of candidates) {
		const skillDir = assertPathWithinRoot(root, path.join(root, candidate));
		try {
			const skillFile = path.join(skillDir, "SKILL.md");
			await access(skillFile);
			return skillDir;
		} catch {}
	}
	throw new Error(`Skill '${nameOrAlias}' does not exist`);
}

function assertPathWithinRoot(root: string, target: string): string {
	const resolvedRoot = path.resolve(root);
	const resolvedTarget = path.resolve(target);
	const relative = path.relative(resolvedRoot, resolvedTarget);
	if (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	) {
		return resolvedTarget;
	}
	throw new Error(`Path escapes skills root: ${target}`);
}

function isNotFoundError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: string }).code === "ENOENT"
	);
}
