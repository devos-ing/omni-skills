import type { SetupDraft } from "./setup.types";

export function renderLocalConfig(draft: SetupDraft): string {
	const config = {
		projects: [
			{
				id: draft.projectId,
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
			githubComment: "piv-github-comment/SKILL.md",
			createTask: "adhd-explore/SKILL.md",
		},
	};

	return [
		'import type { DevosRootConfig, DeepPartial } from "./packages/cli/src/features/types";',
		"",
		"const cwd = process.cwd();",
		"",
		`const config: DeepPartial<DevosRootConfig> = ${stringifyConfig(config)};`,
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
