import type { SetupDraft } from "../setup.types";

export function renderLocalConfig(draft: SetupDraft): string {
	const config = {
		projects: [
			{
				id: draft.projectId,
				name: draft.projectName,
				workspacePath: draft.workspacePath,
				executionPath: draft.executionPath,
				repo: {
					owner: draft.repoOwner,
					name: draft.repoName,
					baseBranch: draft.baseBranch,
				},
				linear: {
					projectId: draft.linearProjectId,
					teamId: draft.linearTeamId,
					statusMap: draft.statusMap,
					labelMap: draft.labelMap,
					autoCreateLabels: true,
				},
			},
		],
		notifications: {
			email: {
				enabled: draft.notifications.email.enabled,
				from: draft.notifications.email.from,
				to: draft.notifications.email.to,
			},
		},
		codex: draft.codex,
		skills: {
			root: "${cwd}/skills",
			plan: "piv-plan/SKILL.md",
			implement: "piv-implement/SKILL.md",
			reviewTest: "piv-review-test/SKILL.md",
		},
	};

	return [
		'import type { AdhdAiRootConfig, DeepPartial } from "./src/core/types";',
		"",
		"const cwd = process.cwd();",
		"",
		`const config: DeepPartial<AdhdAiRootConfig> = ${stringifyConfig(config)};`,
		"",
		"export default config;",
		"",
	].join("\n");
}

function stringifyConfig(value: unknown): string {
	return JSON.stringify(value, null, "\t").replaceAll(
		'"${cwd}/skills"',
		"`${cwd}/skills`",
	);
}
