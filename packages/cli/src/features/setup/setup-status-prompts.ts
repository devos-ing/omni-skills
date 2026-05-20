import type { PromptAdapter } from "../prompts";
import { DEFAULT_STATUS_MAP } from "./constants";
import type { SetupDraft } from "./setup.types";

export async function promptStatusMap(
	prompts: PromptAdapter,
): Promise<SetupDraft["statusMap"]> {
	return {
		backlog: await promptText(
			prompts,
			"Status for backlog",
			DEFAULT_STATUS_MAP.backlog,
		),
		assigned: await promptText(
			prompts,
			"Status for assigned work",
			DEFAULT_STATUS_MAP.assigned,
		),
		planning: await promptText(
			prompts,
			"Status while planning",
			DEFAULT_STATUS_MAP.planning,
		),
		implementing: await promptText(
			prompts,
			"Status while implementing",
			DEFAULT_STATUS_MAP.implementing,
		),
		pr_created: await promptText(
			prompts,
			"Status after PR is created",
			DEFAULT_STATUS_MAP.pr_created,
		),
		reviewing: await promptText(
			prompts,
			"Status while reviewing",
			DEFAULT_STATUS_MAP.reviewing,
		),
		testing: await promptText(
			prompts,
			"Status while testing",
			DEFAULT_STATUS_MAP.testing,
		),
		blocked: await promptText(
			prompts,
			"Status when blocked",
			DEFAULT_STATUS_MAP.blocked,
		),
		done: await promptText(
			prompts,
			"Status when done",
			DEFAULT_STATUS_MAP.done,
		),
	};
}

function promptText(
	prompts: PromptAdapter,
	message: string,
	defaultValue: string,
): Promise<string> {
	return prompts.text({ message, defaultValue, initialValue: defaultValue });
}
