import type { Command } from "commander";
import type {
	CliRuntime,
	ModelsCommand,
	ModelsReasoningEffort,
	ModelsResetCommanderOptions,
	ModelsSetCommanderOptions,
	ModelsStage,
} from "../types/args.types";

const STAGE_LABELS = "brainstorm, plan, implement, review-test, github-comment";
const REASONING_LABELS = "low, medium, high, xhigh";

export function registerModelsCommand(
	program: Command,
	runtime: CliRuntime,
): void {
	const models = program
		.command("models")
		.description("manage instance model settings");
	models.command("list").action(async () => {
		await runtime.handleModelsCommand({ action: "list" }, runtime.cwd);
	});
	models
		.command("set")
		.requiredOption("--stage <STAGE>", `workflow stage: ${STAGE_LABELS}`)
		.option("--model <MODEL>", "model to use for the stage")
		.option(
			"--reasoning-effort <EFFORT>",
			`reasoning effort: ${REASONING_LABELS}`,
		)
		.action(async (options: ModelsSetCommanderOptions, command: Command) => {
			await runtime.handleModelsCommand(
				parseSetOptions(options, command),
				runtime.cwd,
			);
		});
	models
		.command("reset")
		.requiredOption("--stage <STAGE>", `workflow stage: ${STAGE_LABELS}`)
		.action(async (options: ModelsResetCommanderOptions, command: Command) => {
			await runtime.handleModelsCommand(
				{ action: "reset", stage: parseStage(options.stage, command) },
				runtime.cwd,
			);
		});
}

function parseSetOptions(
	options: ModelsSetCommanderOptions,
	command: Command,
): ModelsCommand {
	const model = options.model?.trim();
	const reasoningEffort =
		options.reasoningEffort === undefined
			? undefined
			: parseReasoningEffort(options.reasoningEffort, command);
	if (!model && !reasoningEffort) {
		command.error(
			"models set requires at least one of --model or --reasoning-effort",
		);
	}
	return {
		action: "set",
		stage: parseStage(options.stage, command),
		...(model ? { model } : {}),
		...(reasoningEffort ? { reasoningEffort } : {}),
	};
}

function parseStage(value: string | undefined, command: Command): ModelsStage {
	if (value === "brainstorm") return "brainstorm";
	if (value === "plan") return "plan";
	if (value === "implement") return "implement";
	if (
		value === "review-test" ||
		value === "reviewTest" ||
		value === "testing"
	) {
		return "reviewTest";
	}
	if (value === "github-comment" || value === "githubComment") {
		return "githubComment";
	}
	command.error(`--stage must be one of: ${STAGE_LABELS}`);
}

function parseReasoningEffort(
	value: string,
	command: Command,
): ModelsReasoningEffort {
	if (
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	) {
		return value;
	}
	command.error(`--reasoning-effort must be one of: ${REASONING_LABELS}`);
}
