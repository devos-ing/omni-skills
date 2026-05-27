import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const skillPath = path.join(process.cwd(), "skills", "piv-plan", "SKILL.md");

describe("default PIV planning skill", () => {
	it("documents Superpowers-style planning gates for the planning agent", async () => {
		const skill = await readFile(skillPath, "utf8");

		expect(skill).toContain("Superpowers-Style Planning");
		expect(skill).toContain("use `NEEDS_INFO` instead of guessing");
		expect(skill).toContain("Compare 2-3 viable approaches");
		expect(skill).toContain("recommend one approach");
		expect(skill).toContain("test-first implementation expectation");
		expect(skill).toContain("verification-before-completion");
	});
});
