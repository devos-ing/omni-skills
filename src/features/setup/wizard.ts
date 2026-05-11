import { writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { runCommand } from "../../utils/shell";
import { saveSqliteEnv } from "../config";
import {
	renderSetupGitHubInstallPrompt,
	renderSetupRtkInstallPrompt,
} from "./checks";
import { safeRun } from "./checks-helpers";
import {
	DEFAULT_BASE_BRANCH,
	DEFAULT_LABEL_MAP,
	DEFAULT_PROJECT_NAME,
	DEFAULT_REASONING_EFFORTS,
	DEFAULT_STATUS_MAP,
	ENV_FILE,
	LINEAR_API_KEY_SETTINGS_URL,
	LOCAL_CONFIG_FILE,
} from "./constants";
import { buildEnvUpdates, mergeEnvFile } from "./env-file";
import { renderLocalConfig } from "./local-config";
import { normalizeProjectId } from "./normalize";
import type { SetupDraft } from "./setup.types";
import {
	ask,
	emptyToUndefined,
	inferGitHubDefaults,
	normalizeReasoningEffort,
	normalizeSandbox,
	parseRecipients,
	parseYesNo,
	readExistingFile,
	resolveUserPath,
} from "./wizard-helpers";

export async function runSetupWizard(cwd: string): Promise<void> {
	const io = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	try {
		const rtk = await safeRun(runCommand, "rtk", ["--version"], cwd);
		if (rtk.code !== 0) process.stdout.write(renderSetupRtkInstallPrompt());
		const gh = await safeRun(runCommand, "gh", ["auth", "status"], cwd);
		if (gh.code !== 0) process.stdout.write(renderSetupGitHubInstallPrompt());

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
		const linearApiKey = await ask(
			io,
			`Linear API key (create one: ${LINEAR_API_KEY_SETTINGS_URL})`,
			"",
		);
		const linearProjectId = emptyToUndefined(
			await ask(io, "Linear project ID filter (optional)", ""),
		);
		const linearTeamId = emptyToUndefined(
			await ask(io, "Linear team ID filter (optional)", ""),
		);
		const enableEmailNotifications = parseYesNo(
			await ask(io, "Enable email notifications? (y/N)", "N"),
		);
		const resendApiKey = enableEmailNotifications
			? emptyToUndefined(await ask(io, "Resend API key", ""))
			: undefined;
		const resendFrom = enableEmailNotifications
			? emptyToUndefined(await ask(io, "Resend sender email", ""))
			: undefined;
		const resendTo = enableEmailNotifications
			? parseRecipients(
					await ask(io, "Resend recipients (comma-separated)", ""),
				)
			: [];
		const statusMap = {
			backlog: await ask(io, "Status for backlog", DEFAULT_STATUS_MAP.backlog),
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
		const planReasoningEffort = normalizeReasoningEffort(
			await ask(
				io,
				"Planning reasoning effort",
				DEFAULT_REASONING_EFFORTS.plan,
			),
			DEFAULT_REASONING_EFFORTS.plan,
		);
		const implementReasoningEffort = normalizeReasoningEffort(
			await ask(
				io,
				"Implementation reasoning effort",
				DEFAULT_REASONING_EFFORTS.implement,
			),
			DEFAULT_REASONING_EFFORTS.implement,
		);
		const reviewReasoningEffort = normalizeReasoningEffort(
			await ask(
				io,
				"Review/testing reasoning effort",
				DEFAULT_REASONING_EFFORTS.reviewTest,
			),
			DEFAULT_REASONING_EFFORTS.reviewTest,
		);
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
			notifications: {
				email: {
					enabled: enableEmailNotifications,
					resendApiKey,
					from: resendFrom,
					to: resendTo,
				},
			},
			statusMap,
			labelMap: DEFAULT_LABEL_MAP,
			codex: {
				reasoningEfforts: {
					plan: planReasoningEffort,
					implement: implementReasoningEffort,
					reviewTest: reviewReasoningEffort,
				},
				models: {
					plan: planModel,
					implement: implementModel,
					reviewTest: reviewModel,
				},
				plugins: enablePlugins
					? ["github@openai-curated", "linear@openai-curated"]
					: [],
				skillsets: ["adhd-ai"],
				configOverrides: { "features.codex_hooks": "true" },
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
	await writeFile(envPath, mergeEnvFile(existingEnv, buildEnvUpdates(draft)));
	await saveSqliteEnv(cwd, {
		LINEAR_API_KEY: draft.linearApiKey,
		RESEND_API_KEY: draft.notifications.email.resendApiKey,
	});
	await writeFile(configPath, renderLocalConfig(draft));
}
