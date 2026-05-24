import type {
	DeepPartial,
	DevosRootConfig,
	ProjectConfig,
	ProjectRuntimeConfig,
	ResolvedProjectConfig,
} from "../../features/types";
import { normalizeOptionalPath } from "./path-resolution";
import { resolveSkillsConfig } from "./skills-resolution";

export function resolveProjects(
	configCwd: string,
	base: ProjectRuntimeConfig,
	root: DevosRootConfig,
): ResolvedProjectConfig[] {
	const projectSpecs = root.projects;
	const rootDefaults = stripProjects(root);
	return projectSpecs.map((project) =>
		resolveProject(configCwd, base, rootDefaults, project),
	);
}

function stripProjects(
	root: DevosRootConfig,
): DeepPartial<ProjectRuntimeConfig> {
	const { projects: _, polling: __, notifications: ___, ...rest } = root;
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
	// const skillRoot =
	// 	project.skills?.root ?? rootDefaults.skills?.root ?? base.skills.root;
	// const mergedSkills = {
	// 	plan: project.skills?.plan ?? rootDefaults.skills?.plan ?? base.skills.plan,
	// 	implement:
	// 		project.skills?.implement ??
	// 		rootDefaults.skills?.implement ??
	// 		base.skills.implement,
	// 	reviewTest:
	// 		project.skills?.reviewTest ??
	// 		rootDefaults.skills?.reviewTest ??
	// 		base.skills.reviewTest,
	// 	githubComment:
	// 		project.skills?.githubComment ??
	// 		rootDefaults.skills?.githubComment ??
	// 		base.skills.githubComment,
	// };
	// const mergedAutoSelect = resolveAutoSelectConfig(
	// 	configCwd,
	// 	base.skills.autoSelect,
	// 	rootDefaults.skills?.autoSelect,
	// 	project.skills?.autoSelect,
	// );
	const mergedServerDatabasePath = normalizeOptionalPath(
		project.server?.database?.databasePath ??
			rootDefaults.server?.database?.databasePath ??
			base.server.database.databasePath,
		configCwd,
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
		server: {
			database: {
				databasePath:
					mergedServerDatabasePath ?? base.server.database.databasePath,
				port:
					project.server?.database?.port ??
					rootDefaults.server?.database?.port ??
					base.server.database.port,
			},
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
			mcpServers: [
				...(base.codex.mcpServers ?? []),
				...(rootDefaults.codex?.mcpServers ?? []),
				...(project.codex?.mcpServers ?? []),
			],
		},
		cursor: {
			binary:
				project.cursor?.binary ??
				rootDefaults.cursor?.binary ??
				base.cursor?.binary ??
				"cursor-agent",
			streamLogs:
				project.cursor?.streamLogs ??
				rootDefaults.cursor?.streamLogs ??
				base.cursor?.streamLogs ??
				base.codex.streamLogs,
			model:
				project.cursor?.model ??
				rootDefaults.cursor?.model ??
				base.cursor?.model,
			force:
				project.cursor?.force ??
				rootDefaults.cursor?.force ??
				base.cursor?.force,
			apiKey:
				project.cursor?.apiKey ??
				rootDefaults.cursor?.apiKey ??
				base.cursor?.apiKey,
		},
		claude: {
			...(base.claude ?? {}),
			...(rootDefaults.claude ?? {}),
			...(project.claude ?? {}),
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
