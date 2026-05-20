import { clackPromptAdapter } from "../prompts";
import type { PromptAdapter } from "../prompts";
import {
	DEFAULT_BASE_BRANCH,
	DEFAULT_LABEL_MAP,
	DEFAULT_PROJECT_NAME,
	DEFAULT_REASONING_EFFORTS,
	LINEAR_API_KEY_SETTINGS_URL,
} from "./constants";
import { normalizeProjectId } from "./normalize";
import { promptStatusMap } from "./setup-status-prompts";
import type { SetupDraft, SetupDraftPromptDeps } from "./setup.types";
import {
	emptyToUndefined,
	inferGitHubDefaults,
	normalizeReasoningEffort,
	normalizeSandbox,
	parseRecipients,
	resolveUserPath,
} from "./wizard-helpers";

const SANDBOX_OPTIONS = [
	{ value: "workspace-write", label: "Workspace write" },
	{ value: "read-only", label: "Read only" },
	{ value: "danger-full-access", label: "Danger full access" },
	{ value: "none", label: "None" },
] as const;

const REASONING_EFFORT_OPTIONS = [
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
	{ value: "xhigh", label: "Extra high" },
] as const;

export async function collectSetupDraft(
	cwd: string,
	deps: Partial<SetupDraftPromptDeps> = {},
): Promise<SetupDraft> {
	const prompts = deps.prompts ?? clackPromptAdapter;
	const inferDefaults = deps.inferGitHubDefaults ?? inferGitHubDefaults;
	const projectName = await promptText(
		prompts,
		"Project name",
		DEFAULT_PROJECT_NAME,
	);
	const projectId = await promptText(
		prompts,
		"Project ID",
		normalizeProjectId(projectName),
	);
	const executionPath = resolveUserPath(
		await promptText(prompts, "Local repository path", cwd),
	);
	const defaults = await inferDefaults(executionPath);
	const repoOwner = await promptText(
		prompts,
		"GitHub owner",
		defaults.owner ?? "",
	);
	const repoName = await promptText(
		prompts,
		"GitHub repository name",
		defaults.name ?? "",
	);
	const baseBranch = await promptText(
		prompts,
		"GitHub base branch",
		defaults.baseBranch ?? DEFAULT_BASE_BRANCH,
	);
	const linearApiKey = await prompts.password({
		message: `Linear API key (create one: ${LINEAR_API_KEY_SETTINGS_URL})`,
	});
	const linearProjectId = emptyToUndefined(
		await promptText(prompts, "Linear project ID filter (optional)", ""),
	);
	const linearTeamId = emptyToUndefined(
		await promptText(
			prompts,
			"Linear team ID filter (optional; inferred from project when possible)",
			"",
		),
	);
	const enableEmailNotifications = await prompts.confirm({
		message: "Enable email notifications?",
		initialValue: false,
	});
	const resendApiKey = enableEmailNotifications
		? emptyToUndefined(await prompts.password({ message: "Resend API key" }))
		: undefined;
	const resendFrom = enableEmailNotifications
		? emptyToUndefined(await promptText(prompts, "Resend sender email", ""))
		: undefined;
	const resendTo = enableEmailNotifications
		? parseRecipients(
				await promptText(prompts, "Resend recipients (comma-separated)", ""),
			)
		: [];
	const statusMap = await promptStatusMap(prompts);
	const sandbox = normalizeSandbox(
		await prompts.select({
			message: "Codex sandbox",
			options: [...SANDBOX_OPTIONS],
			initialValue: "workspace-write",
		}),
	);
	const planModel = await promptText(prompts, "Planning model", "gpt-5.5");
	const implementModel = await promptText(
		prompts,
		"Implementation model",
		"gpt-5.3-codex",
	);
	const reviewModel = await promptText(
		prompts,
		"Review/testing model",
		"gpt-5.3-codex",
	);
	const planReasoningEffort = normalizeReasoningEffort(
		await promptReasoningEffort(
			prompts,
			"Planning reasoning effort",
			DEFAULT_REASONING_EFFORTS.plan,
		),
		DEFAULT_REASONING_EFFORTS.plan,
	);
	const implementReasoningEffort = normalizeReasoningEffort(
		await promptReasoningEffort(
			prompts,
			"Implementation reasoning effort",
			DEFAULT_REASONING_EFFORTS.implement,
		),
		DEFAULT_REASONING_EFFORTS.implement,
	);
	const reviewReasoningEffort = normalizeReasoningEffort(
		await promptReasoningEffort(
			prompts,
			"Review/testing reasoning effort",
			DEFAULT_REASONING_EFFORTS.reviewTest,
		),
		DEFAULT_REASONING_EFFORTS.reviewTest,
	);
	const enablePlugins = await prompts.confirm({
		message: "Enable GitHub and Linear Codex plugins?",
		initialValue: true,
	});

	return {
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
				githubComment: reviewReasoningEffort,
			},
			models: {
				plan: planModel,
				implement: implementModel,
				reviewTest: reviewModel,
				githubComment: reviewModel,
			},
			plugins: enablePlugins
				? ["github@openai-curated", "linear@openai-curated"]
				: [],
			skillsets: ["devos"],
			configOverrides: { "features.codex_hooks": "true" },
			sandbox,
		},
	};
}

function promptText(
	prompts: PromptAdapter,
	message: string,
	defaultValue: string,
): Promise<string> {
	return prompts.text({ message, defaultValue, initialValue: defaultValue });
}

function promptReasoningEffort(
	prompts: PromptAdapter,
	message: string,
	initialValue: "low" | "medium" | "high" | "xhigh",
): Promise<string> {
	return prompts.select({
		message,
		options: [...REASONING_EFFORT_OPTIONS],
		initialValue,
	});
}
