import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IssueRef } from "../src/features/types";
import {
	loadDatabaseSkillCandidates,
	loadFolderSkillCandidates,
	rankSkillCandidates,
} from "../src/skills/catalog";

const issue: IssueRef = {
	id: "lin_roy_43",
	key: "ROY-43",
	title: "Auto pick planning skills from folder and database",
	description: "Select relevant skills by requirements.",
	url: "https://linear.app/roy/issue/ROY-43",
};

describe("loadFolderSkillCandidates", () => {
	it("loads nested SKILL.md files and excludes base planning skill", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "adhd-skills-"));
		const basePlanPath = path.join(tempDir, "piv-plan", "SKILL.md");
		const dbSkillPath = path.join(tempDir, "db", "SKILL.md");
		const nestedSkillPath = path.join(tempDir, "ops", "triage", "SKILL.md");

		await mkdir(path.dirname(basePlanPath), { recursive: true });
		await mkdir(path.dirname(dbSkillPath), { recursive: true });
		await mkdir(path.dirname(nestedSkillPath), { recursive: true });

		await writeFile(basePlanPath, "name: base-plan\ndescription: base skill\n");
		await writeFile(
			dbSkillPath,
			"name: db-skill\ndescription: Database planning support\n",
		);
		await writeFile(
			nestedSkillPath,
			"description: incident runbook and triage procedures\n",
		);

		try {
			const candidates = await loadFolderSkillCandidates(tempDir, basePlanPath);
			expect(candidates).toHaveLength(2);
			expect(candidates.map((c) => c.name).sort()).toEqual([
				"db-skill",
				"triage",
			]);
			expect(
				candidates.find((candidate) => candidate.name === "db-skill")
					?.description,
			).toBe("Database planning support");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("discovers bundled backend/frontend/typescript standards skills", async () => {
		const skillsRoot = path.join(process.cwd(), "skills");
		const basePlanPath = path.join(skillsRoot, "piv-plan", "SKILL.md");

		const candidates = await loadFolderSkillCandidates(
			skillsRoot,
			basePlanPath,
		);
		const names = new Set(candidates.map((candidate) => candidate.name));

		expect(names.has("backend-standard")).toBe(true);
		expect(names.has("frontend-standard")).toBe(true);
		expect(names.has("daily-codebase-maintenance")).toBe(true);
		expect(names.has("typescript-biome-style")).toBe(true);
	});
});

describe("loadDatabaseSkillCandidates", () => {
	it("reads rows from skills table and parses tags", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "adhd-skills-db-"));
		const dbPath = path.join(tempDir, "skills.sqlite");
		const db = new Database(dbPath, { create: true });
		try {
			db.run(
				"CREATE TABLE skills (name TEXT NOT NULL, description TEXT, content TEXT, path TEXT, tags TEXT)",
			);
			db.query(
				"INSERT INTO skills (name, description, content, path, tags) VALUES (?1, ?2, ?3, ?4, ?5)",
			).run(
				"db-optimizer",
				"Improve database planning",
				"skill content",
				"/tmp/db/SKILL.md",
				'["database","query"]',
			);
			db.query(
				"INSERT INTO skills (name, description, content, path, tags) VALUES (?1, ?2, ?3, ?4, ?5)",
			).run("ops", "Ops support", null, null, "incident,triage");
		} finally {
			db.close(false);
		}

		try {
			const candidates = loadDatabaseSkillCandidates(dbPath);
			expect(candidates).toHaveLength(2);
			expect(candidates[0]?.name).toBe("db-optimizer");
			expect(candidates[0]?.tags).toEqual(["database", "query"]);
			expect(candidates[1]?.tags).toEqual(["incident", "triage"]);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("throws clear error when schema is missing skills table", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "adhd-skills-db-"));
		const dbPath = path.join(tempDir, "skills.sqlite");
		const db = new Database(dbPath, { create: true });
		try {
			db.run("CREATE TABLE wrong (name TEXT NOT NULL)");
		} finally {
			db.close(false);
		}

		try {
			expect(() => loadDatabaseSkillCandidates(dbPath)).toThrow(
				"Expected schema: skills(name, description, content, path, tags)",
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("rankSkillCandidates", () => {
	it("ranks deterministically and honors maxSelected", () => {
		const ranked = rankSkillCandidates(
			[
				{
					name: "database-planning",
					description: "Database requirement planning",
					content: "database query optimization",
					path: "/tmp/db/SKILL.md",
					tags: [],
					source: "database",
				},
				{
					name: "database-planning",
					description: "Database requirement planning",
					content: "database query optimization",
					path: "/tmp/folder/SKILL.md",
					tags: [],
					source: "folder",
				},
				{
					name: "linear-triage",
					description: "Linear issue workflow",
					content: "label and status transitions",
					path: "/tmp/linear/SKILL.md",
					tags: ["workflow"],
					source: "folder",
				},
			],
			issue,
			1,
		);

		expect(ranked).toHaveLength(1);
		expect(ranked[0]?.name).toBe("database-planning");
		expect(ranked[0]?.source).toBe("folder");
	});

	it("ranks coding standards skills for backend/frontend/typescript biome issues", async () => {
		const skillsRoot = path.join(process.cwd(), "skills");
		const basePlanPath = path.join(skillsRoot, "piv-plan", "SKILL.md");
		const candidates = await loadFolderSkillCandidates(
			skillsRoot,
			basePlanPath,
		);

		const standardsIssue: IssueRef = {
			id: "lin_roy_59",
			key: "ROY-59",
			title: "Enhance skill for coding structure and backend standard",
			description:
				"We need a backend skill, frontend skill, and coding styles for TypeScript with Biome.",
			url: "https://linear.app/roy/issue/ROY-59/enhance-skill",
		};

		const ranked = rankSkillCandidates(candidates, standardsIssue, 5);
		const rankedNames = ranked.map((candidate) => candidate.name);

		expect(rankedNames).toContain("backend-standard");
		expect(rankedNames).toContain("frontend-standard");
		expect(rankedNames).toContain("typescript-biome-style");
	});

	it("ranks daily maintenance skill for recurring codebase cleanup issues", async () => {
		const skillsRoot = path.join(process.cwd(), "skills");
		const basePlanPath = path.join(skillsRoot, "piv-plan", "SKILL.md");
		const candidates = await loadFolderSkillCandidates(
			skillsRoot,
			basePlanPath,
		);

		const maintenanceIssue: IssueRef = {
			id: "lin_roy_62",
			key: "ROY-62",
			title: "Define a skill for daily codebase maintenance",
			description:
				"Use backend-standard and typescript-biome-style to maintain the codebase, remove unused code, and keep reliability high.",
			url: "https://linear.app/roy/issue/ROY-62",
		};

		const ranked = rankSkillCandidates(candidates, maintenanceIssue, 8);
		const rankedNames = ranked.map((candidate) => candidate.name);

		expect(rankedNames).toContain("daily-codebase-maintenance");
	});
});
