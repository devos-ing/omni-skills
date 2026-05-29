import path from "node:path";
import type { DeepPartial, ProjectRuntimeConfig } from "../types";
import { normalizeOptionalPath } from "./path-resolution";

type SkillConfig = ProjectRuntimeConfig["skills"];

export function resolveSkillsConfig(
	configCwd: string,
	base: SkillConfig,
	rootOverride: DeepPartial<SkillConfig> | undefined,
	projectOverride: DeepPartial<SkillConfig> | undefined,
): SkillConfig {
	const root = projectOverride?.root ?? rootOverride?.root ?? base.root;
	const merged = {
		brainstorm:
			projectOverride?.brainstorm ??
			rootOverride?.brainstorm ??
			base.brainstorm,
		plan: projectOverride?.plan ?? rootOverride?.plan ?? base.plan,
		implement:
			projectOverride?.implement ?? rootOverride?.implement ?? base.implement,
		reviewTest:
			projectOverride?.reviewTest ??
			rootOverride?.reviewTest ??
			base.reviewTest,
		githubComment:
			projectOverride?.githubComment ??
			rootOverride?.githubComment ??
			base.githubComment,
		createTask:
			projectOverride?.createTask ??
			rootOverride?.createTask ??
			base.createTask ??
			path.join("adhd-explore", "SKILL.md"),
	};

	return {
		root,
		brainstorm: resolveSkillPath(root, merged.brainstorm),
		plan: resolveSkillPath(root, merged.plan),
		implement: resolveSkillPath(root, merged.implement),
		reviewTest: resolveSkillPath(root, merged.reviewTest),
		githubComment: resolveSkillPath(root, merged.githubComment),
		createTask: resolveSkillPath(root, merged.createTask),
		autoSelect: resolveAutoSelectConfig(
			configCwd,
			base.autoSelect,
			rootOverride?.autoSelect,
			projectOverride?.autoSelect,
		),
		pluginSkillPaths: [
			...(base.pluginSkillPaths ?? []),
			...(rootOverride?.pluginSkillPaths ?? []),
			...(projectOverride?.pluginSkillPaths ?? []),
		],
	};
}

function resolveSkillPath(root: string, input: string): string {
	if (path.isAbsolute(input)) {
		return input;
	}
	return path.resolve(root, input);
}

function resolveAutoSelectConfig(
	configCwd: string,
	base: SkillConfig["autoSelect"] | undefined,
	rootOverride: DeepPartial<NonNullable<SkillConfig["autoSelect"]>> | undefined,
	projectOverride:
		| DeepPartial<NonNullable<SkillConfig["autoSelect"]>>
		| undefined,
): NonNullable<SkillConfig["autoSelect"]> {
	const mergedEnabled =
		projectOverride?.enabled ?? rootOverride?.enabled ?? base?.enabled ?? false;
	const mergedFolderSource =
		projectOverride?.sources?.folder ??
		rootOverride?.sources?.folder ??
		base?.sources?.folder ??
		true;
	const mergedDatabaseSource =
		projectOverride?.sources?.database ??
		rootOverride?.sources?.database ??
		base?.sources?.database ??
		false;
	return {
		enabled: mergedEnabled === true,
		sources: {
			folder: mergedFolderSource === true,
			database: mergedDatabaseSource === true,
		},
		databasePath: normalizeOptionalPath(
			projectOverride?.databasePath ??
				rootOverride?.databasePath ??
				base?.databasePath,
			configCwd,
		),
		maxSelected: normalizeMaxSelected(
			projectOverride?.maxSelected ??
				rootOverride?.maxSelected ??
				base?.maxSelected,
		),
	};
}

function normalizeMaxSelected(input: unknown): number {
	if (typeof input !== "number" || !Number.isInteger(input) || input <= 0) {
		return 3;
	}
	return input;
}
