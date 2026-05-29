import { availableAgentModels } from "adapters";
import type { CodexReasoningEffort } from "adapters";
import {
	loadInstanceConfig,
	saveInstanceConfig,
} from "devos/features/onboard/instance-config";
import type { OnboardInstanceConfig } from "devos/features/onboard/types/instance-config.types";
import type {
	SettingsModelConfigKey,
	SettingsModelStageDefinition,
	SettingsModelStageUpdate,
	SettingsModelsResponse,
	SettingsModelsUpdateRequest,
} from "./types/settings-models.types";

const REASONING_EFFORTS: CodexReasoningEffort[] = [
	"low",
	"medium",
	"high",
	"xhigh",
];

const STAGES: SettingsModelStageDefinition[] = [
	{ id: "brainstorm", label: "Brainstorm", configKey: "brainstorm" },
	{ id: "plan", label: "Plan", configKey: "plan" },
	{ id: "implement", label: "Implement", configKey: "implement" },
	{ id: "testing", label: "Testing", configKey: "reviewTest" },
];

export class SettingsModelsError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "SettingsModelsError";
	}
}

export async function getSettingsModels(
	cwd: string,
): Promise<SettingsModelsResponse> {
	const config = await readInstanceConfig(cwd);
	return renderSettingsModels(config);
}

export async function updateSettingsModels(
	cwd: string,
	request: unknown,
): Promise<SettingsModelsResponse> {
	validateUpdateRequest(request);
	const config = await readInstanceConfig(cwd);
	config.codex ??= {};
	for (const stage of request.stages) {
		applyStageUpdate(config, stage);
	}
	pruneEmptyCodexSections(config);
	await saveInstanceConfig(config);
	return renderSettingsModels(config);
}

function renderSettingsModels(
	config: OnboardInstanceConfig,
): SettingsModelsResponse {
	return {
		stages: STAGES.map((stage) => ({
			id: stage.id,
			label: stage.label,
			...(config.codex?.models?.[stage.configKey]
				? { model: config.codex.models[stage.configKey] }
				: {}),
			...(config.codex?.reasoningEfforts?.[stage.configKey]
				? { reasoningEffort: config.codex.reasoningEfforts[stage.configKey] }
				: {}),
		})),
		availableModels: [...availableAgentModels.codex],
		reasoningEfforts: [...REASONING_EFFORTS],
	};
}

async function readInstanceConfig(cwd: string): Promise<OnboardInstanceConfig> {
	const result = await loadInstanceConfig(cwd);
	if (!result.ok) {
		throw new SettingsModelsError(404, result.message);
	}
	return result.config;
}

function applyStageUpdate(
	config: OnboardInstanceConfig,
	update: SettingsModelStageUpdate,
): void {
	const configKey = resolveConfigKey(update.id);
	if ("model" in update) {
		const model = normalizeModel(update.model);
		config.codex ??= {};
		config.codex.models ??= {};
		if (model) {
			config.codex.models[configKey] = model;
		} else {
			delete config.codex.models[configKey];
		}
	}
	if ("reasoningEffort" in update) {
		config.codex ??= {};
		config.codex.reasoningEfforts ??= {};
		if (update.reasoningEffort) {
			config.codex.reasoningEfforts[configKey] = update.reasoningEffort;
		} else {
			delete config.codex.reasoningEfforts[configKey];
		}
	}
}

function validateUpdateRequest(
	request: unknown,
): asserts request is SettingsModelsUpdateRequest {
	if (!isRecord(request) || !Array.isArray(request.stages)) {
		throw new SettingsModelsError(400, "settings update requires stages");
	}
	for (const stage of request.stages) {
		if (!isRecord(stage)) {
			throw new SettingsModelsError(400, "settings stage must be an object");
		}
		if (typeof stage.id !== "string") {
			throw new SettingsModelsError(400, "settings stage id must be a string");
		}
		resolveConfigKey(stage.id);
		if (
			stage.model !== undefined &&
			stage.model !== null &&
			typeof stage.model !== "string"
		) {
			throw new SettingsModelsError(400, "settings model must be a string");
		}
		if (
			stage.reasoningEffort !== undefined &&
			stage.reasoningEffort !== null &&
			!isReasoningEffort(stage.reasoningEffort)
		) {
			throw new SettingsModelsError(400, "invalid reasoning effort");
		}
	}
}

function resolveConfigKey(stageId: string): SettingsModelConfigKey {
	const stage = STAGES.find((candidate) => candidate.id === stageId);
	if (!stage) {
		throw new SettingsModelsError(400, "unknown settings model stage");
	}
	return stage.configKey;
}

function normalizeModel(value: string | null | undefined): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isReasoningEffort(value: unknown): value is CodexReasoningEffort {
	return REASONING_EFFORTS.includes(value as CodexReasoningEffort);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function pruneEmptyCodexSections(config: OnboardInstanceConfig): void {
	if (!config.codex) return;
	if (config.codex.models && Object.keys(config.codex.models).length === 0) {
		config.codex.models = undefined;
	}
	if (
		config.codex.reasoningEfforts &&
		Object.keys(config.codex.reasoningEfforts).length === 0
	) {
		config.codex.reasoningEfforts = undefined;
	}
	if (!config.codex.models && !config.codex.reasoningEfforts) {
		config.codex = undefined;
	}
}
