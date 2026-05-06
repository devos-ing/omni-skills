import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
	DeepPartial,
	PivLoopRootConfig,
	PollingConfig,
	ProjectConfig,
	ProjectRuntimeConfig,
	ResolvedProjectConfig,
} from "./types";

const DEFAULT_CONFIG_FILE = "piv-loop.config.ts";

type RootOverride = DeepPartial<PivLoopRootConfig>;
type LegacyOverride = DeepPartial<ProjectRuntimeConfig>;
type AnyOverride = RootOverride | LegacyOverride;

export interface LoadedConfig {
	projects: ResolvedProjectConfig[];
	polling: PollingConfig;
}

export async function loadConfig(cwd: string): Promise<LoadedConfig> {
	const envBase = buildEnvBase(cwd);
	const envPolling = buildEnvPolling();
	const loadedOverride = await loadConfigOverride(cwd);
	const root = normalizeOverrideToRoot(loadedOverride);
	assertNoProjectPolling(root.projects);
	const projects = resolveProjects(envBase, root);
	const polling = resolvePolling(envPolling, root.polling);
	validateProjects(projects);
	validatePolling(polling);
	return { projects, polling };
}

export function getProjectById(
	config: LoadedConfig,
	projectId: string,
): ResolvedProjectConfig | undefined {
	return config.projects.find((project) => project.id === projectId);
}

function buildEnvBase(cwd: string): ProjectRuntimeConfig {
	const env = process.env;
	const workspacePath = env.PIV_WORKSPACE_PATH ?? cwd;
	const sandbox = normalizeSandboxValue(env.CODEX_SANDBOX);
	const codexHome = normalizeOptionalValue(env.CODEX_HOME);
	return {
		workspacePath,
		executionPath: env.PIV_EXECUTION_PATH ?? workspacePath,
		repo: {
			owner: env.GITHUB_REPO_OWNER ?? "",
			name: env.GITHUB_REPO_NAME ?? "",
			baseBranch: env.GITHUB_BASE_BRANCH ?? "main",
		},
		linear: {
			apiKey: env.LINEAR_API_KEY ?? "",
			apiUrl: env.LINEAR_API_URL ?? "https://api.linear.app/graphql",
			teamId: env.LINEAR_TEAM_ID,
			requiredLabel: env.LINEAR_REQUIRED_LABEL,
			pollLimit: Number(env.PIV_POLL_LIMIT ?? "10"),
			statusMap: {
				assigned: env.LINEAR_STATUS_ASSIGNED ?? "Todo",
				planning: env.LINEAR_STATUS_PLANNING ?? "In Progress",
				implementing: env.LINEAR_STATUS_IMPLEMENTING ?? "In Progress",
				pr_created: env.LINEAR_STATUS_PR_CREATED ?? "In Review",
				reviewing: env.LINEAR_STATUS_REVIEWING ?? "In Review",
				testing: env.LINEAR_STATUS_TESTING ?? "In Review",
				blocked: env.LINEAR_STATUS_BLOCKED ?? "Canceled",
				done: env.LINEAR_STATUS_DONE ?? "Done",
			},
			labelMap: {
				pr_created: env.LINEAR_LABEL_PR_CREATED ?? "PR Created",
				reviewing: env.LINEAR_LABEL_REVIEWING ?? "Reviewing",
				testing: env.LINEAR_LABEL_TESTING ?? "Testing",
			},
			autoCreateLabels: env.LINEAR_AUTO_CREATE_LABELS !== "0",
		},
		github: {
			useGhCli: true,
			defaultBugLabel: env.GITHUB_BUG_LABEL ?? "bug",
		},
		codex: {
			binary: env.CODEX_BINARY ?? "codex",
			model: env.CODEX_MODEL,
			models: {
				plan: env.CODEX_MODEL_PLAN,
				implement: env.CODEX_MODEL_IMPLEMENT,
				reviewTest: env.CODEX_MODEL_REVIEW_TEST,
			},
			sandbox,
			codexHome,
		},
		skills: {
			plan: path.join(cwd, "skills", "piv-plan", "SKILL.md"),
			implement: path.join(cwd, "skills", "piv-implement", "SKILL.md"),
			reviewTest: path.join(cwd, "skills", "piv-review-test", "SKILL.md"),
		},
		dryRun: env.PIV_DRY_RUN === "1",
	};
}

function buildEnvPolling(): PollingConfig {
	const env = process.env;
	return {
		intervalMs: Number(env.PIV_POLL_INTERVAL_MS ?? "30000"),
		maxCycles: parseOptionalPositiveInt(env.PIV_MAX_POLL_CYCLES),
		exitWhenIdle: env.PIV_EXIT_WHEN_IDLE !== "0",
	};
}

async function loadConfigOverride(cwd: string): Promise<AnyOverride> {
	const configPath = path.join(cwd, DEFAULT_CONFIG_FILE);
	try {
		await access(configPath);
	} catch {
		return {};
	}

	const imported = await import(pathToFileURL(configPath).href);
	const override = imported.default ?? imported.config ?? {};
	return override as AnyOverride;
}

function normalizeOverrideToRoot(override: AnyOverride): PivLoopRootConfig {
	if ("projects" in override && Array.isArray(override.projects)) {
		return override as PivLoopRootConfig;
	}

	const legacy = override as DeepPartial<ProjectRuntimeConfig>;
	return {
		...legacy,
		projects: [
			{
				id: "default",
			},
		],
	};
}

function resolveProjects(
	base: ProjectRuntimeConfig,
	root: PivLoopRootConfig,
): ResolvedProjectConfig[] {
	const projectSpecs =
		root.projects.length > 0 ? root.projects : [{ id: "default" }];
	const rootDefaults = stripProjects(root);
	const resolved = projectSpecs.map((project) =>
		resolveProject(base, rootDefaults, project),
	);
	return resolved;
}

function stripProjects(
	root: PivLoopRootConfig,
): DeepPartial<ProjectRuntimeConfig> {
	const { projects: _, polling: __, ...rest } = root;
	return rest;
}

function resolvePolling(
	base: PollingConfig,
	override: DeepPartial<PollingConfig> | undefined,
): PollingConfig {
	return {
		...base,
		...(override ?? {}),
	};
}

function resolveProject(
	base: ProjectRuntimeConfig,
	rootDefaults: DeepPartial<ProjectRuntimeConfig>,
	project: ProjectConfig,
): ResolvedProjectConfig {
	const mergedRuntime = mergeRuntime(base, rootDefaults, project);
	const id = project.id.trim();
	const name = project.name?.trim() || id;

	return {
		...mergedRuntime,
		id,
		name,
	};
}

function mergeRuntime(
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
		},
		skills: {
			...base.skills,
			...(rootDefaults.skills ?? {}),
			...(project.skills ?? {}),
		},
		dryRun: project.dryRun ?? rootDefaults.dryRun ?? base.dryRun,
	};
}

function parseOptionalPositiveInt(
	value: string | undefined,
): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return undefined;
	}
	return parsed;
}

function validateProjects(projects: ResolvedProjectConfig[]): void {
	if (projects.length === 0) {
		throw new Error("At least one project configuration is required");
	}

	const seen = new Set<string>();
	for (const project of projects) {
		if (!project.id) {
			throw new Error("Project id cannot be empty");
		}
		if (seen.has(project.id)) {
			throw new Error(`Duplicate project id: ${project.id}`);
		}
		seen.add(project.id);
		validateProject(project);
	}
}

function normalizeOptionalValue(input: string | undefined): string | undefined {
	if (!input) {
		return undefined;
	}
	const value = input.trim();
	return value ? value : undefined;
}

function normalizeSandboxValue(
	input: string | undefined,
): ProjectRuntimeConfig["codex"]["sandbox"] | undefined {
	if (!input) {
		return undefined;
	}

	const value = input.trim().toLowerCase();
	if (!value || value === "off" || value === "none" || value === "0") {
		return undefined;
	}

	if (value === "read-only") {
		return "read-only";
	}
	if (value === "workspace-write") {
		return "workspace-write";
	}
	if (value === "danger-full-access") {
		return "danger-full-access";
	}

	throw new Error(
		`Invalid CODEX_SANDBOX value '${input}'. Use read-only, workspace-write, danger-full-access, or leave empty.`,
	);
}

function validateProject(project: ResolvedProjectConfig): void {
	if (!project.linear.apiKey) {
		throw new Error(`LINEAR_API_KEY is required for project '${project.id}'`);
	}
	if (!project.executionPath) {
		throw new Error(`Execution path is required for project '${project.id}'`);
	}

	const requiredStateIds = Object.entries(project.linear.statusMap).filter(
		([, value]) => !value,
	);
	if (requiredStateIds.length > 0) {
		throw new Error(
			`Missing Linear status ids for project '${project.id}': ${requiredStateIds
				.map(([key]) => key)
				.join(", ")}`,
		);
	}
}

function validatePolling(polling: PollingConfig): void {
	if (!Number.isInteger(polling.intervalMs) || polling.intervalMs <= 0) {
		throw new Error("Polling interval must be a positive integer");
	}
	if (
		polling.maxCycles !== undefined &&
		(!Number.isInteger(polling.maxCycles) || polling.maxCycles <= 0)
	) {
		throw new Error("Polling max cycles must be a positive integer");
	}
}

function assertNoProjectPolling(projects: ProjectConfig[]): void {
	for (const project of projects) {
		if ("polling" in (project as unknown as Record<string, unknown>)) {
			throw new Error(
				`Project-level polling config is not supported for project '${project.id}'. Configure polling once at root level.`,
			);
		}
	}
}
