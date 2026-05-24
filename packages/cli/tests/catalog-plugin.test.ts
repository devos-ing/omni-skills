import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IssueRef } from "../src/features/types";
import { selectPlanningSupplementalSkills } from "../src/skills/catalog";

const issue: IssueRef = {
	id: "lin_roy_43",
	key: "ROY-43",
	title: "Send Slack notifications from workflow",
	description: "Use a connector skill.",
	url: "https://linear.app/roy/issue/ROY-43",
};

describe("plugin supplemental skills", () => {
	it("selects plugin skills even when folder auto-select is off", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "adhd-plugin-skill-"));
		const pluginSkill = path.join(tempDir, "slack", "SKILL.md");
		await mkdir(path.dirname(pluginSkill), { recursive: true });
		await writeFile(
			pluginSkill,
			"name: slack\ndescription: Slack connector notifications\n",
		);
		try {
			const result = await selectPlanningSupplementalSkills(
				{
					skills: {
						root: tempDir,
						plan: path.join(tempDir, "plan", "SKILL.md"),
						implement: "",
						reviewTest: "",
						githubComment: "",
						autoSelect: {
							enabled: false,
							sources: { folder: false, database: false },
							maxSelected: 3,
						},
						pluginSkillPaths: [pluginSkill],
					},
				} as Parameters<typeof selectPlanningSupplementalSkills>[0],
				issue,
			);

			expect(result.selected[0]?.name).toBe("slack");
			expect(result.selected[0]?.source).toBe("plugin");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
