import { instanceConfigPath } from "../config";
import { loadInstanceConfig, saveInstanceConfig } from "../onboard";
import type {
	ModelStage,
	ModelsCommand,
	ModelsCommandDeps,
} from "./types/model-command.types";

const STAGES = [
	"brainstorm",
	"plan",
	"implement",
	"reviewTest",
	"githubComment",
] as const;

export async function handleModelsCommand(
	command: ModelsCommand,
	cwd: string,
	deps: ModelsCommandDeps = {},
): Promise<void> {
	const write = deps.write ?? process.stdout.write.bind(process.stdout);
	if (command.action === "list") {
		const config = await readInstanceConfig(cwd, deps);
		write(renderModelsList(config));
		return;
	}

	const config = await readInstanceConfig(cwd, deps);
	if (command.action === "set") {
		applyModelSettings(config, command);
		await (deps.saveInstanceConfig ?? saveInstanceConfig)(config);
		write(`Updated ${stageLabel(command.stage)} model settings.\n`);
		return;
	}

	resetModelSettings(config, command.stage);
	await (deps.saveInstanceConfig ?? saveInstanceConfig)(config);
	write(`Reset ${stageLabel(command.stage)} model settings.\n`);
}

async function readInstanceConfig(cwd: string, deps: ModelsCommandDeps) {
	const result = await (deps.loadInstanceConfig ?? loadInstanceConfig)(cwd);
	if (!result.ok) {
		throw new Error(
			`Instance config is unavailable at ${instanceConfigPath()}. Run devos onboard first.`,
		);
	}
	return result.config;
}

function applyModelSettings(
	config: Awaited<ReturnType<typeof readInstanceConfig>>,
	command: Extract<ModelsCommand, { action: "set" }>,
): void {
	config.codex ??= {};
	if (command.model !== undefined) {
		config.codex.models = {
			...(config.codex.models ?? {}),
			[command.stage]: command.model,
		};
	}
	if (command.reasoningEffort !== undefined) {
		config.codex.reasoningEfforts = {
			...(config.codex.reasoningEfforts ?? {}),
			[command.stage]: command.reasoningEffort,
		};
	}
}

function resetModelSettings(
	config: Awaited<ReturnType<typeof readInstanceConfig>>,
	stage: ModelStage,
): void {
	if (!config.codex) return;
	if (config.codex.models) {
		delete config.codex.models[stage];
		if (Object.keys(config.codex.models).length === 0) {
			config.codex.models = undefined;
		}
	}
	if (config.codex.reasoningEfforts) {
		delete config.codex.reasoningEfforts[stage];
		if (Object.keys(config.codex.reasoningEfforts).length === 0) {
			config.codex.reasoningEfforts = undefined;
		}
	}
	if (!config.codex.models && !config.codex.reasoningEfforts) {
		config.codex = undefined;
	}
}

function renderModelsList(
	config: Awaited<ReturnType<typeof readInstanceConfig>>,
): string {
	const lines = ["Stage\tModel\tReasoning effort"];
	for (const stage of STAGES) {
		lines.push(
			[
				stageLabel(stage),
				config.codex?.models?.[stage] ?? "-",
				config.codex?.reasoningEfforts?.[stage] ?? "-",
			].join("\t"),
		);
	}
	return `${lines.join("\n")}\n`;
}

function stageLabel(stage: ModelStage): string {
	if (stage === "reviewTest") return "review-test";
	if (stage === "githubComment") return "github-comment";
	return stage;
}
