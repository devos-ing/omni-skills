import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	addSkill,
	listSkills,
	removeSkill,
	updateSkill,
} from "../src/skills/manage";

describe("skills manage", () => {
	it("adds and lists a skill using the SKILL.md template", async () => {
		const tempDir = await mkdtemp(
			path.join(os.tmpdir(), "adhd-skills-manage-"),
		);
		try {
			const created = await addSkill(tempDir, {
				title: "Backend Standard",
				description: "Repository backend practices",
				content: "Keep modules focused and test changes.",
			});
			expect(created.name).toBe("backend-standard");

			const skillFile = await readFile(created.path, "utf8");
			expect(skillFile).toContain("name: Backend Standard");
			expect(skillFile).toContain("description: Repository backend practices");
			expect(skillFile).toContain("Keep modules focused and test changes.");

			const listed = await listSkills(tempDir);
			expect(listed).toHaveLength(1);
			expect(listed[0]?.name).toBe("backend-standard");
			expect(listed[0]?.title).toBe("Backend Standard");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("prevents overwriting an existing skill on add", async () => {
		const tempDir = await mkdtemp(
			path.join(os.tmpdir(), "adhd-skills-manage-"),
		);
		try {
			await addSkill(tempDir, {
				title: "Backend Standard",
				description: "Repository backend practices",
				content: "Initial content.",
			});
			await expect(
				addSkill(tempDir, {
					title: "Backend Standard",
					description: "Repository backend practices",
					content: "Replacement content.",
				}),
			).rejects.toThrow("Skill 'backend-standard' already exists");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("updates skill fields and preserves unspecified values", async () => {
		const tempDir = await mkdtemp(
			path.join(os.tmpdir(), "adhd-skills-manage-"),
		);
		try {
			const created = await addSkill(tempDir, {
				title: "Backend Standard",
				description: "Repository backend practices",
				content: "Initial content.",
			});

			await updateSkill(tempDir, created.name, {
				description: "Updated description",
			});

			const skillFile = await readFile(created.path, "utf8");
			expect(skillFile).toContain("name: Backend Standard");
			expect(skillFile).toContain("description: Updated description");
			expect(skillFile).toContain("Initial content.");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("removes a skill directory", async () => {
		const tempDir = await mkdtemp(
			path.join(os.tmpdir(), "adhd-skills-manage-"),
		);
		try {
			const created = await addSkill(tempDir, {
				title: "Backend Standard",
				description: "Repository backend practices",
				content: "Initial content.",
			});
			await removeSkill(tempDir, created.name);

			const listed = await listSkills(tempDir);
			expect(listed).toHaveLength(0);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("rejects unsafe skill name input for existing-skill operations", async () => {
		const tempDir = await mkdtemp(
			path.join(os.tmpdir(), "adhd-skills-manage-"),
		);
		try {
			await expect(removeSkill(tempDir, "../escape")).rejects.toThrow(
				"Invalid skill name: '../escape'",
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("preserves frontmatter skill content when updating metadata only", async () => {
		const tempDir = await mkdtemp(
			path.join(os.tmpdir(), "adhd-skills-manage-"),
		);
		const skillDir = path.join(tempDir, "piv-plan");
		const skillPath = path.join(skillDir, "SKILL.md");
		try {
			await mkdir(skillDir, { recursive: true });
			const sourceSkill = await readFile(
				path.join(process.cwd(), "skills", "piv-plan", "SKILL.md"),
				"utf8",
			);
			await writeFile(skillPath, sourceSkill, "utf8");

			await updateSkill(tempDir, "piv-plan", {
				description: "Updated planning description",
			});

			const updatedSkill = await readFile(skillPath, "utf8");
			expect(updatedSkill).toContain("---\nname: adhd-plan");
			expect(updatedSkill).toContain(
				"description: Updated planning description",
			);
			expect(updatedSkill).toContain("# ADHD.ai Plan Skill");
			expect(updatedSkill).toContain("## Goals");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
