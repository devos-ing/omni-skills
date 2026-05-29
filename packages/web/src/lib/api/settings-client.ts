import {
	assertObjectRecord,
	readString,
	readStringArray,
} from "./response-utils";
import type { HealthRequestOptions } from "./types/client.types";
import type {
	SettingsModelOption,
	SettingsModelStage,
	SettingsModelsResponse,
	SettingsModelsUpdateRequest,
	SettingsReasoningEffort,
} from "./types/settings.types";

const SETTINGS_MODELS_PATH = "/api/settings/models";
const REASONING_EFFORTS = ["low", "medium", "high", "xhigh"] as const;

type RequestWithBase = (
	path: string,
	method: "GET" | "PATCH",
	options?: HealthRequestOptions,
	body?: unknown,
) => Promise<unknown>;

export function createSettingsApiMethods(requestWithBase: RequestWithBase): {
	getModelSettings(
		options?: HealthRequestOptions,
	): Promise<SettingsModelsResponse>;
	updateModelSettings(
		request: SettingsModelsUpdateRequest,
		options?: HealthRequestOptions,
	): Promise<SettingsModelsResponse>;
} {
	return {
		async getModelSettings(options) {
			const payload = await requestWithBase(
				SETTINGS_MODELS_PATH,
				"GET",
				options,
			);
			return parseSettingsModelsResponse(payload);
		},
		async updateModelSettings(request, options) {
			const payload = await requestWithBase(
				SETTINGS_MODELS_PATH,
				"PATCH",
				options,
				request,
			);
			return parseSettingsModelsResponse(payload);
		},
	};
}

function parseSettingsModelsResponse(payload: unknown): SettingsModelsResponse {
	const row = assertObjectRecord(payload, SETTINGS_MODELS_PATH);
	return {
		stages: parseArray(row.stages, parseSettingsModelStage),
		availableModels: parseArray(row.availableModels, parseSettingsModelOption),
		reasoningEfforts: readStringArray(
			row,
			"reasoningEfforts",
			SETTINGS_MODELS_PATH,
		).map(parseReasoningEffort),
	};
}

function parseSettingsModelStage(payload: unknown): SettingsModelStage {
	const row = assertObjectRecord(payload, SETTINGS_MODELS_PATH);
	const stage: SettingsModelStage = {
		id: parseStageId(readString(row, "id", SETTINGS_MODELS_PATH)),
		label: readString(row, "label", SETTINGS_MODELS_PATH),
	};
	if (typeof row.model === "string") {
		stage.model = row.model;
	}
	if (typeof row.reasoningEffort === "string") {
		stage.reasoningEffort = parseReasoningEffort(row.reasoningEffort);
	}
	return stage;
}

function parseSettingsModelOption(payload: unknown): SettingsModelOption {
	const row = assertObjectRecord(payload, SETTINGS_MODELS_PATH);
	const option: SettingsModelOption = {
		id: readString(row, "id", SETTINGS_MODELS_PATH),
		label: readString(row, "label", SETTINGS_MODELS_PATH),
		description: readString(row, "description", SETTINGS_MODELS_PATH),
	};
	if (Array.isArray(row.defaultFor)) {
		option.defaultFor = row.defaultFor.filter(
			(value): value is string => typeof value === "string",
		);
	}
	return option;
}

function parseArray<T>(value: unknown, parseItem: (item: unknown) => T): T[] {
	if (!Array.isArray(value)) {
		throw new Error(`Invalid ${SETTINGS_MODELS_PATH} response array`);
	}
	return value.map(parseItem);
}

function parseStageId(value: string): SettingsModelStage["id"] {
	if (
		value === "brainstorm" ||
		value === "plan" ||
		value === "implement" ||
		value === "testing"
	) {
		return value;
	}
	throw new Error(`Invalid ${SETTINGS_MODELS_PATH} response field 'id'`);
}

function parseReasoningEffort(value: string): SettingsReasoningEffort {
	if (REASONING_EFFORTS.includes(value as SettingsReasoningEffort)) {
		return value as SettingsReasoningEffort;
	}
	throw new Error(
		`Invalid ${SETTINGS_MODELS_PATH} response field 'reasoningEffort'`,
	);
}
