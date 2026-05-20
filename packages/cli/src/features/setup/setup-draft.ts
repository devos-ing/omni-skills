import { clackPromptAdapter } from "../prompts";
import type { PromptAdapter } from "../prompts";
import {
	DEFAULT_BASE_BRANCH,
	DEFAULT_LABEL_MAP,
	DEFAULT_PROJECT_NAME,
	DEFAULT_REASONING_EFFORTS,
	DEFAULT_STATUS_MAP,
} from "./constants";
import { normalizeProjectId } from "./normalize";
import type { SetupDraft, SetupDraftPromptDeps } from "./setup.types";
import {
	inferGitHubDefaults,
	normalizeReasoningEffort,
	normalizeSandbox,
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
	const projectDescription = await promptText(
		prompts,
		"Project description",
		"",
	);
	const lead = await promptText(prompts, "Project lead", "");
	const category = await promptText(prompts, "Project category", "");
	const priority = normalizePriority(
		await promptText(prompts, "Project priority", ""),
	);
	const executionPath = resolveUserPath(cwd);
	const defaults = await inferDefaults(executionPath);
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
		projectDescription: projectDescription.trim(),
		workspacePath: executionPath,
		executionPath,
		repoOwner: defaults.owner ?? "",
		repoName: defaults.name ?? "",
		baseBranch: defaults.baseBranch ?? DEFAULT_BASE_BRANCH,
		lead: lead.trim(),
		category: category.trim(),
		priority,
		linearApiKey: process.env.LINEAR_API_KEY ?? "",
		notifications: {
			email: {
				enabled: false,
				to: [],
			},
		},
		statusMap: { ...DEFAULT_STATUS_MAP },
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

function normalizePriority(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}
	const parsed = Number(trimmed);
	return Number.isInteger(parsed) ? parsed : null;
}
