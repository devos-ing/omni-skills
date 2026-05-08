import { access, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { findClaudeBinary } from "../utils/claude-path";
import type { CommandResult } from "../utils/shell";
import { runCommand } from "../utils/shell";
import type { LoadedConfig } from "./config";
import { loadConfig, saveSqliteEnv } from "./config";

const ENV_FILE = ".env";
const LOCAL_CONFIG_FILE = "adhd-ai.local.config.ts";
const DEFAULT_PROJECT_NAME = "Default Project";
const DEFAULT_BASE_BRANCH = "main";
const RTK_INSTALL_URL = "https://github.com/rtk-ai/rtk";

export interface SetupDraft {
	projectId: string;
	projectName: string;
	workspacePath: string;
	executionPath: string;
	repoOwner: string;
	repoName: string;
	baseBranch: string;
	linearApiKey: string;
	linearProjectId?: string;
	linearTeamId?: string;
	statusMap: {
		assigned: string;
		planning: string;
		implementing: string;
		pr_created: string;
		reviewing: string;
		testing: string;
		blocked: string;
		done: string;
	};
	labelMap: {
		pr_created: string;
		reviewing: string;
		testing: string;
	};
	codex: {
		models: {
			plan: string;
			implement: string;
			reviewTest: string;
		};
		plugins: string[];
		skillsets: string[];
		configOverrides: Record<string, string>;
		sandbox?: "read-only" | "workspace-write" | "danger-full-access";
	};
}

export interface SetupCheck {
	name: string;
	status: "pass" | "fail";
	message: string;
}

interface SetupCheckDeps {
	loadConfig?: (cwd: string) => Promise<LoadedConfig>;
	runCommand?: (
		command: string,
		args: string[],
		options: { cwd: string },
	) => Promise<CommandResult>;
	access?: (targetPath: string) => Promise<void>;
	readFile?: (targetPath: string, encoding: BufferEncoding) => Promise<string>;
}

interface GitHubDefaults {
	owner?: string;
	name?: string;
	baseBranch?: string;
}

export const DEFAULT_STATUS_MAP: SetupDraft["statusMap"] = {
	assigned: "Todo",
	planning: "In Progress",
	implementing: "In Progress",
	pr_created: "In Review",
	reviewing: "In Review",
	testing: "In Review",
	blocked: "Canceled",
	done: "Done",
};

export const DEFAULT_LABEL_MAP: SetupDraft["labelMap"] = {
	pr_created: "PR Created",
	reviewing: "Reviewing",
	testing: "Testing",
};

export function normalizeProjectId(input: string): string {
	const normalized = input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || "default";
}

export function renderEnvFile(draft: Pick<SetupDraft, "linearApiKey">): string {
	return `${renderEnvEntries({ LINEAR_API_KEY: draft.linearApiKey })}\n`;
}

export function mergeEnvFile(
	existingContent: string | undefined,
	updates: Record<string, string | undefined>,
): string {
	if (!existingContent) {
		return `${renderEnvEntries(updates)}\n`;
	}

	const lines = existingContent.split(/\r?\n/);
	const seen = new Set<string>();
	const merged = lines.map((line) => {
		const match = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
		if (!match) {
			return line;
		}
		const key = match[1];
		if (!(key in updates)) {
			return line;
		}
		seen.add(key);
		return renderEnvEntry(key, updates[key] ?? "");
	});

	const missingEntries = Object.entries(updates).filter(
		([key]) => !seen.has(key),
	);
	if (missingEntries.length > 0) {
		if (merged.at(-1)?.trim()) {
			merged.push("");
		}
		for (const [key, value] of missingEntries) {
			merged.push(renderEnvEntry(key, value ?? ""));
		}
	}

	return `${merged.join("\n").replace(/\n+$/g, "")}\n`;
}

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

export function formatSetupChecks(checks: SetupCheck[]): string {
	const lines = checks.map((check) => {
		const marker = check.status === "pass" ? "PASS" : "FAIL";
		return `${marker}: ${check.name} - ${check.message}`;
	});
	return `${lines.join("\n")}\n`;
}

export async function collectSetupChecks(
	cwd: string,
	deps: SetupCheckDeps = {},
): Promise<SetupCheck[]> {
	const configLoader = deps.loadConfig ?? loadConfig;
	const commandRunner = deps.runCommand ?? runCommand;
	const accessPath = deps.access ?? access;
	const readText = deps.readFile ?? readFile;
	const checks: SetupCheck[] = [];
	let config: LoadedConfig;

	try {
		config = await configLoader(cwd);
		checks.push({
			name: "Config",
			status: "pass",
			message: "configuration loaded successfully",
		});
	} catch (error) {
		checks.push({
			name: "Config",
			status: "fail",
			message: error instanceof Error ? error.message : String(error),
		});
		return checks;
	}

	const missingApiKeyProjects = config.projects
		.filter((project) => !project.linear.apiKey)
		.map((project) => project.id);
	checks.push(
		missingApiKeyProjects.length === 0
			? {
					name: "Linear API key",
					status: "pass",
					message: "configured for every project",
				}
			: {
					name: "Linear API key",
					status: "fail",
					message: `missing for projects: ${missingApiKeyProjects.join(", ")}`,
				},
	);

	for (const project of config.projects) {
		try {
			await accessPath(project.executionPath);
			checks.push({
				name: `Execution path (${project.id})`,
				status: "pass",
				message: project.executionPath,
			});
		} catch {
			checks.push({
				name: `Execution path (${project.id})`,
				status: "fail",
				message: `${project.executionPath} does not exist or is not accessible`,
			});
		}
	}
	for (const project of config.projects) {
		const skillChecks: Array<[string, string]> = [
			["plan", project.skills.plan],
			["implement", project.skills.implement],
			["reviewTest", project.skills.reviewTest],
		];
		for (const [stage, skillPath] of skillChecks) {
			try {
				await accessPath(skillPath);
				checks.push({
					name: `Skill file (${project.id}:${stage})`,
					status: "pass",
					message: skillPath,
				});
			} catch {
				checks.push({
					name: `Skill file (${project.id}:${stage})`,
					status: "fail",
					message: `${skillPath} does not exist or is not accessible`,
				});
			}
		}
	}
	for (const project of config.projects) {
		const autoSelect = project.skills.autoSelect;
		if (!autoSelect?.enabled) {
			continue;
		}

		if (autoSelect.sources.folder) {
			try {
				await accessPath(project.skills.root);
				checks.push({
					name: `Skill auto-select folder (${project.id})`,
					status: "pass",
					message: project.skills.root,
				});
			} catch {
				checks.push({
					name: `Skill auto-select folder (${project.id})`,
					status: "fail",
					message: `${project.skills.root} does not exist or is not accessible`,
				});
			}
		}

		if (autoSelect.sources.database) {
			const databasePath = autoSelect.databasePath?.trim();
			if (!databasePath) {
				checks.push({
					name: `Skill auto-select database (${project.id})`,
					status: "fail",
					message:
						"skills.autoSelect.databasePath is required when database source is enabled",
				});
				continue;
			}
			try {
				await accessPath(databasePath);
				checks.push({
					name: `Skill auto-select database (${project.id})`,
					status: "pass",
					message: databasePath,
				});
			} catch {
				checks.push({
					name: `Skill auto-select database (${project.id})`,
					status: "fail",
					message: `${databasePath} does not exist or is not accessible`,
				});
			}
		}
	}

	const commandCwd = config.projects[0]?.executionPath ?? cwd;
	const gh = await safeRun(commandRunner, "gh", ["auth", "status"], commandCwd);
	checks.push(
		gh.code === 0
			? { name: "GitHub auth", status: "pass", message: "gh is authenticated" }
			: {
					name: "GitHub auth",
					status: "fail",
					message: commandFailureMessage(gh),
				},
	);

	const rtk = await safeRun(commandRunner, "rtk", ["--version"], commandCwd);
	checks.push(
		rtk.code === 0
			? {
					name: "RTK binary",
					status: "pass",
					message: "rtk is available",
				}
			: {
					name: "RTK binary",
					status: "fail",
					message: formatMissingRtkMessage(),
				},
	);

	const codexBackends = config.projects.filter(
		(project) => !project.agent?.backend || project.agent.backend === "codex",
	);
	if (codexBackends.length > 0) {
		const codexBinary = config.projects[0]?.codex.binary ?? "codex";
		const codex = await safeRun(
			commandRunner,
			codexBinary,
			["--version"],
			commandCwd,
		);
		checks.push(
			codex.code === 0
				? {
						name: "Codex binary",
						status: "pass",
						message: `${codexBinary} is available`,
					}
				: {
						name: "Codex binary",
						status: "fail",
						message: commandFailureMessage(codex),
					},
		);
	}

	const claudeCodeBackends = config.projects.filter(
		(project) => project.agent?.backend === "claude-code",
	);
	if (claudeCodeBackends.length > 0) {
		const claudePath = findClaudeBinary();
		if (claudePath) {
			const claude = await safeRun(
				commandRunner,
				claudePath,
				["--version"],
				commandCwd,
			);
			checks.push(
				claude.code === 0
					? {
							name: "Claude Code binary",
							status: "pass",
							message: `${claudePath} is available`,
						}
					: {
							name: "Claude Code binary",
							status: "fail",
							message: commandFailureMessage(claude),
						},
			);
		} else {
			checks.push({
				name: "Claude Code binary",
				status: "fail",
				message:
					"claude binary not found. Install with: npm install -g @anthropic-ai/claude-code",
			});
		}
	}

	checks.push(await checkTrackedConfigSecrets(cwd, config, readText));

	return checks;
}

export async function runSetupCheck(cwd: string): Promise<void> {
	const checks = await collectSetupChecks(cwd);
	process.stdout.write(formatSetupChecks(checks));
	if (checks.some((check) => check.status === "fail")) {
		throw new Error("Setup check failed");
	}
}

export async function runSetupWizard(cwd: string): Promise<void> {
	const io = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	try {
		const rtk = await safeRun(runCommand, "rtk", ["--version"], cwd);
		if (rtk.code !== 0) {
			process.stdout.write(renderSetupRtkInstallPrompt());
		}

		const projectName = await ask(io, "Project name", DEFAULT_PROJECT_NAME);
		const projectId = await ask(
			io,
			"Project ID",
			normalizeProjectId(projectName),
		);
		const executionPath = resolveUserPath(
			await ask(io, "Local repository path", cwd),
		);
		const defaults = await inferGitHubDefaults(executionPath);
		const repoOwner = await ask(io, "GitHub owner", defaults.owner ?? "");
		const repoName = await ask(
			io,
			"GitHub repository name",
			defaults.name ?? "",
		);
		const baseBranch = await ask(
			io,
			"GitHub base branch",
			defaults.baseBranch ?? DEFAULT_BASE_BRANCH,
		);
		const linearApiKey = await ask(io, "Linear API key", "");
		const linearProjectId = emptyToUndefined(
			await ask(io, "Linear project ID filter (optional)", ""),
		);
		const linearTeamId = emptyToUndefined(
			await ask(io, "Linear team ID filter (optional)", ""),
		);
		const statusMap = {
			assigned: await ask(
				io,
				"Status for assigned work",
				DEFAULT_STATUS_MAP.assigned,
			),
			planning: await ask(
				io,
				"Status while planning",
				DEFAULT_STATUS_MAP.planning,
			),
			implementing: await ask(
				io,
				"Status while implementing",
				DEFAULT_STATUS_MAP.implementing,
			),
			pr_created: await ask(
				io,
				"Status after PR is created",
				DEFAULT_STATUS_MAP.pr_created,
			),
			reviewing: await ask(
				io,
				"Status while reviewing",
				DEFAULT_STATUS_MAP.reviewing,
			),
			testing: await ask(
				io,
				"Status while testing",
				DEFAULT_STATUS_MAP.testing,
			),
			blocked: await ask(io, "Status when blocked", DEFAULT_STATUS_MAP.blocked),
			done: await ask(io, "Status when done", DEFAULT_STATUS_MAP.done),
		};
		const sandbox = normalizeSandbox(
			await ask(io, "Codex sandbox", "workspace-write"),
		);
		const planModel = await ask(io, "Planning model", "gpt-5.5");
		const implementModel = await ask(
			io,
			"Implementation model",
			"gpt-5.3-codex",
		);
		const reviewModel = await ask(io, "Review/testing model", "gpt-5.3-codex");
		const enablePlugins = parseYesNo(
			await ask(io, "Enable GitHub and Linear Codex plugins? (Y/n)", "Y"),
		);

		const draft: SetupDraft = {
			projectId: normalizeProjectId(projectId),
			projectName: projectName.trim() || DEFAULT_PROJECT_NAME,
			workspacePath: executionPath,
			executionPath,
			repoOwner,
			repoName,
			baseBranch,
			linearApiKey,
			linearProjectId,
			linearTeamId,
			statusMap,
			labelMap: DEFAULT_LABEL_MAP,
			codex: {
				models: {
					plan: planModel,
					implement: implementModel,
					reviewTest: reviewModel,
				},
				plugins: enablePlugins
					? ["github@openai-curated", "linear@openai-curated"]
					: [],
				skillsets: ["adhd-ai"],
				configOverrides: {
					"features.codex_hooks": "true",
				},
				sandbox,
			},
		};

		await writeSetupFiles(cwd, draft);
		process.stdout.write(
			`Setup files written: ${ENV_FILE}, ${LOCAL_CONFIG_FILE}; secrets saved to .piv-loop/config/env.sqlite\nRun 'adhd-ai setup --check' to validate this machine.\n`,
		);
	} finally {
		io.close();
	}
}

export async function writeSetupFiles(
	cwd: string,
	draft: SetupDraft,
): Promise<void> {
	const envPath = path.join(cwd, ENV_FILE);
	const configPath = path.join(cwd, LOCAL_CONFIG_FILE);
	const existingEnv = await readExistingFile(envPath);
	await writeFile(
		envPath,
		mergeEnvFile(existingEnv, { LINEAR_API_KEY: draft.linearApiKey }),
	);
	await saveSqliteEnv(cwd, { LINEAR_API_KEY: draft.linearApiKey });
	await writeFile(configPath, renderLocalConfig(draft));
}

async function readExistingFile(filePath: string): Promise<string | undefined> {
	try {
		return await readFile(filePath, "utf8");
	} catch {
		return undefined;
	}
}

async function ask(
	io: readline.Interface,
	label: string,
	defaultValue: string,
): Promise<string> {
	const suffix = defaultValue ? ` [${defaultValue}]` : "";
	const answer = await io.question(`${label}${suffix}: `);
	return answer.trim() || defaultValue;
}

async function inferGitHubDefaults(cwd: string): Promise<GitHubDefaults> {
	const remote = await safeRun(
		runCommand,
		"git",
		["config", "--get", "remote.origin.url"],
		cwd,
	);
	const branch = await safeRun(
		runCommand,
		"git",
		["symbolic-ref", "refs/remotes/origin/HEAD", "--short"],
		cwd,
	);
	const parsed = parseGitHubRemote(remote.stdout.trim());
	const branchName = branch.stdout.trim().replace(/^origin\//, "");
	return {
		...parsed,
		baseBranch: branchName || DEFAULT_BASE_BRANCH,
	};
}

function parseGitHubRemote(
	remote: string,
): Pick<GitHubDefaults, "owner" | "name"> {
	const httpsMatch =
		/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(remote);
	if (httpsMatch) {
		return { owner: httpsMatch[1], name: httpsMatch[2] };
	}
	const sshMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/.exec(remote);
	if (sshMatch) {
		return { owner: sshMatch[1], name: sshMatch[2] };
	}
	return {};
}

async function safeRun(
	commandRunner: NonNullable<SetupCheckDeps["runCommand"]>,
	command: string,
	args: string[],
	cwd: string,
): Promise<CommandResult> {
	try {
		return await commandRunner(command, args, { cwd });
	} catch (error) {
		return {
			code: 1,
			stdout: "",
			stderr: error instanceof Error ? error.message : String(error),
		};
	}
}

async function checkTrackedConfigSecrets(
	cwd: string,
	config: LoadedConfig,
	readText: NonNullable<SetupCheckDeps["readFile"]>,
): Promise<SetupCheck> {
	const secretValues = new Set<string>();
	for (const project of config.projects) {
		if (project.linear.apiKey) {
			secretValues.add(project.linear.apiKey);
		}
	}
	if (config.notifications.email.resendApiKey) {
		secretValues.add(config.notifications.email.resendApiKey);
	}

	const trackedConfigPaths = ["adhd-ai.config.ts", "piv-loop.config.ts"].map(
		(fileName) => path.join(cwd, fileName),
	);

	for (const configPath of trackedConfigPaths) {
		const content = await readOptionalText(configPath, readText);
		if (!content) {
			continue;
		}
		for (const secret of secretValues) {
			if (secret.length >= 8 && content.includes(secret)) {
				return {
					name: "Tracked config secrets",
					status: "fail",
					message: `${path.basename(configPath)} contains a configured secret`,
				};
			}
		}
	}

	return {
		name: "Tracked config secrets",
		status: "pass",
		message: "no configured secrets found in tracked config files",
	};
}

async function readOptionalText(
	filePath: string,
	readText: NonNullable<SetupCheckDeps["readFile"]>,
): Promise<string | undefined> {
	try {
		return await readText(filePath, "utf8");
	} catch {
		return undefined;
	}
}

function commandFailureMessage(result: CommandResult): string {
	const output = (result.stderr || result.stdout).trim();
	return output || `command exited with ${result.code}`;
}

function formatMissingRtkMessage(): string {
	return `rtk binary not found. Install from: ${RTK_INSTALL_URL}`;
}

export function renderSetupRtkInstallPrompt(): string {
	return `RTK is required for ADHD.ai agent workflow commands.\nInstall RTK before running workflows: ${RTK_INSTALL_URL}\n`;
}

function renderEnvEntries(entries: Record<string, string | undefined>): string {
	return Object.entries(entries)
		.map(([key, value]) => renderEnvEntry(key, value ?? ""))
		.join("\n");
}

function renderEnvEntry(key: string, value: string): string {
	return `${key}=${quoteEnvValue(value)}`;
}

function quoteEnvValue(value: string): string {
	if (/^[A-Za-z0-9_./:@-]*$/.test(value)) {
		return value;
	}
	return JSON.stringify(value);
}

function stringifyConfig(value: unknown): string {
	return JSON.stringify(value, null, "\t").replaceAll(
		'"${cwd}/skills"',
		"`${cwd}/skills`",
	);
}

function resolveUserPath(input: string): string {
	if (input === "~") {
		return os.homedir();
	}
	if (input.startsWith("~/")) {
		return path.join(os.homedir(), input.slice(2));
	}
	return path.resolve(input);
}

function emptyToUndefined(input: string): string | undefined {
	const value = input.trim();
	return value ? value : undefined;
}

function normalizeSandbox(
	input: string,
): SetupDraft["codex"]["sandbox"] | undefined {
	const value = input.trim();
	if (!value || value === "off" || value === "none" || value === "0") {
		return undefined;
	}
	if (
		value === "read-only" ||
		value === "workspace-write" ||
		value === "danger-full-access"
	) {
		return value;
	}
	return "workspace-write";
}

function parseYesNo(input: string): boolean {
	const value = input.trim().toLowerCase();
	return value === "" || value === "y" || value === "yes" || value === "true";
}
