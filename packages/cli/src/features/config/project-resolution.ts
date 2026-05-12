import type {
	AdhdAiRootConfig,
	DeepPartial,
	ProjectConfig,
	ProjectRuntimeConfig,
	ResolvedProjectConfig,
} from "../../features/types";
import { resolveSkillsConfig } from "./skills-resolution";

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
			models: {
				...(base.codex.models ?? {}),
				...(rootDefaults.codex?.models ?? {}),
				...(project.codex?.models ?? {}),
			},
			fastModes: {
				...(base.codex.fastModes ?? {}),
				...(rootDefaults.codex?.fastModes ?? {}),
				...(project.codex?.fastModes ?? {}),
			},
		},
		skills: resolveSkillsConfig(
			configCwd,
			base.skills,
			rootDefaults.skills,
			project.skills,
		),
		agent: {
			...base.agent,
			...(rootDefaults.agent ?? {}),
			...(project.agent ?? {}),
		},
		workflow: {
			...base.workflow,
			...(rootDefaults.workflow ?? {}),
			...(project.workflow ?? {}),
			isolatedWorktrees: {
				enabled:
					project.workflow?.isolatedWorktrees?.enabled ??
					rootDefaults.workflow?.isolatedWorktrees?.enabled ??
					base.workflow.isolatedWorktrees?.enabled ??
					false,
				root:
					project.workflow?.isolatedWorktrees?.root ??
					rootDefaults.workflow?.isolatedWorktrees?.root ??
					base.workflow.isolatedWorktrees?.root,
			},
		},
		dryRun: project.dryRun ?? rootDefaults.dryRun ?? base.dryRun,
	};
}
