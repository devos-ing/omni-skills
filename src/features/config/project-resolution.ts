import path from "node:path";
import type {
	AdhdAiRootConfig,
	DeepPartial,
	ProjectConfig,
	ProjectRuntimeConfig,
	ResolvedProjectConfig,
} from "../../core/types";

export function resolveProjects(
	configCwd: string,
	base: ProjectRuntimeConfig,
	root: AdhdAiRootConfig,
): ResolvedProjectConfig[] {
	const projectSpecs =
		root.projects.length > 0 ? root.projects : [{ id: "default" }];
	const rootDefaults = stripProjects(root);
	return projectSpecs.map((project) =>
		resolveProject(configCwd, base, rootDefaults, project),
	);
}

function stripProjects(
	root: AdhdAiRootConfig,
): DeepPartial<ProjectRuntimeConfig> {
	const {
		projects: _,
		polling: __,
		automations: ___,
		cron: ____,
		notifications: _____,
		...rest
	} = root;
	return rest;
}

function resolveProject(
	configCwd: string,
	base: ProjectRuntimeConfig,
	rootDefaults: DeepPartial<ProjectRuntimeConfig>,
	project: ProjectConfig,
): ResolvedProjectConfig {
	const mergedRuntime = mergeRuntime(configCwd, base, rootDefaults, project);
	const id = project.id.trim();
	const name = project.name?.trim() || id;
	return { ...mergedRuntime, id, name };
}

function mergeRuntime(
	configCwd: string,
	base: ProjectRuntimeConfig,
	rootDefaults: DeepPartial<ProjectRuntimeConfig>,
	project: ProjectConfig,
): ProjectRuntimeConfig {
	const workspacePath =
		project.workspacePath ?? rootDefaults.workspacePath ?? base.workspacePath;
	const executionPath =
		project.executionPath ??
		rootDefaults.executionPath ??
		project.workspacePath ??
		rootDefaults.workspacePath ??
		base.executionPath;
	const skillRoot =
		project.skills?.root ?? rootDefaults.skills?.root ?? base.skills.root;
	const mergedSkills = {
		plan: project.skills?.plan ?? rootDefaults.skills?.plan ?? base.skills.plan,
		implement:
			project.skills?.implement ??
			rootDefaults.skills?.implement ??
			base.skills.implement,
		reviewTest:
			project.skills?.reviewTest ??
			rootDefaults.skills?.reviewTest ??
			base.skills.reviewTest,
	};
	const mergedAutoSelect = resolveAutoSelectConfig(
		configCwd,
		base.skills.autoSelect,
		rootDefaults.skills?.autoSelect,
		project.skills?.autoSelect,
	);
	return {
		workspacePath,
		executionPath,
		repo: {
			...base.repo,
			...(rootDefaults.repo ?? {}),
			...(project.repo ?? {}),
		},
		linear: {
			...base.linear,
			...(rootDefaults.linear ?? {}),
			...(project.linear ?? {}),
			statusMap: {
				...base.linear.statusMap,
				...(rootDefaults.linear?.statusMap ?? {}),
				...(project.linear?.statusMap ?? {}),
			},
			labelMap: {
				...base.linear.labelMap,
				...(rootDefaults.linear?.labelMap ?? {}),
				...(project.linear?.labelMap ?? {}),
			},
		},
		github: {
			...base.github,
			...(rootDefaults.github ?? {}),
			...(project.github ?? {}),
		},
		codex: {
			...base.codex,
			...(rootDefaults.codex ?? {}),
			...(project.codex ?? {}),
			docker: {
				...(base.codex.docker ?? {}),
				...(rootDefaults.codex?.docker ?? {}),
				...(project.codex?.docker ?? {}),
			},
			reasoningEfforts: {
				...(base.codex.reasoningEfforts ?? {}),
				...(rootDefaults.codex?.reasoningEfforts ?? {}),
				...(project.codex?.reasoningEfforts ?? {}),
			},
			fastModes: {
				...(base.codex.fastModes ?? {}),
				...(rootDefaults.codex?.fastModes ?? {}),
				...(project.codex?.fastModes ?? {}),
			},
		},
		skills: {
			root: skillRoot,
			plan: resolveSkillPath(skillRoot, mergedSkills.plan),
			implement: resolveSkillPath(skillRoot, mergedSkills.implement),
			reviewTest: resolveSkillPath(skillRoot, mergedSkills.reviewTest),
			autoSelect: mergedAutoSelect,
		},
		agent: {
			...base.agent,
			...(rootDefaults.agent ?? {}),
			...(project.agent ?? {}),
		},
		workflow: {
			...base.workflow,
			...(rootDefaults.workflow ?? {}),
			...(project.workflow ?? {}),
		},
		dryRun: project.dryRun ?? rootDefaults.dryRun ?? base.dryRun,
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
	base: ProjectRuntimeConfig["skills"]["autoSelect"] | undefined,
	rootOverride:
		| DeepPartial<NonNullable<ProjectRuntimeConfig["skills"]["autoSelect"]>>
		| undefined,
	projectOverride:
		| DeepPartial<NonNullable<ProjectRuntimeConfig["skills"]["autoSelect"]>>
		| undefined,
): NonNullable<ProjectRuntimeConfig["skills"]["autoSelect"]> {
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
	const mergedDatabasePath = normalizeOptionalPath(
		projectOverride?.databasePath ??
			rootOverride?.databasePath ??
			base?.databasePath,
		configCwd,
	);
	const mergedMaxSelected = normalizeMaxSelected(
		projectOverride?.maxSelected ??
			rootOverride?.maxSelected ??
			base?.maxSelected,
	);
	return {
		enabled: mergedEnabled === true,
		sources: {
			folder: mergedFolderSource === true,
			database: mergedDatabaseSource === true,
		},
		databasePath: mergedDatabasePath,
		maxSelected: mergedMaxSelected,
	};
}

function normalizeOptionalPath(
	input: unknown,
	baseDir: string,
): string | undefined {
	if (typeof input !== "string") {
		return undefined;
	}
	const trimmed = input.trim();
	if (!trimmed) {
		return undefined;
	}
	return path.isAbsolute(trimmed)
		? trimmed
		: path.resolve(baseDir || process.cwd(), trimmed);
}

function normalizeMaxSelected(input: unknown): number {
	if (typeof input !== "number" || !Number.isInteger(input) || input <= 0) {
		return 3;
	}
	return input;
}
