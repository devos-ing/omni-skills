import {
	assertObjectRecord,
	parseListResponse,
	readNullableNumber,
	readNullableString,
	readNumber,
	readString,
	readStringArray,
} from "./response-utils";
import type {
	AgentRecord,
	AgentStatus,
	CommandHistoryRecord,
	HealthResponse,
	JobRecord,
	SkillRecord,
	TokenUsageRecord,
} from "./types/client.types";

export function parseHealthResponse(payload: unknown): HealthResponse {
	if (
		typeof payload !== "object" ||
		payload === null ||
		!("status" in payload) ||
		payload.status !== "ok"
	) {
		throw new Error("Invalid /health response payload");
	}
	return payload as HealthResponse;
}

export function parseTokenUsageRecord(payload: unknown): TokenUsageRecord {
	const row = assertObjectRecord(payload, "/api/token-usage");
	return {
		id: readString(row, "id", "/api/token-usage"),
		runId: readString(row, "runId", "/api/token-usage"),
		taskId: readNullableString(row, "taskId", "/api/token-usage"),
		taskExecutionLogId: readNullableString(
			row,
			"taskExecutionLogId",
			"/api/token-usage",
		),
		stage: readString(row, "stage", "/api/token-usage"),
		agentBackend: readNullableString(row, "agentBackend", "/api/token-usage"),
		model: readNullableString(row, "model", "/api/token-usage"),
		inputTokens: readNumber(row, "inputTokens", "/api/token-usage"),
		outputTokens: readNumber(row, "outputTokens", "/api/token-usage"),
		totalTokens: readNumber(row, "totalTokens", "/api/token-usage"),
		estimatedCostMicrousd: readNullableNumber(
			row,
			"estimatedCostMicrousd",
			"/api/token-usage",
		),
		recordedAt: readString(row, "recordedAt", "/api/token-usage"),
	};
}

export function parseJobRecord(payload: unknown): JobRecord {
	const row = assertObjectRecord(payload, "/api/jobs");
	return {
		id: readString(row, "id", "/api/jobs"),
		projectId: readString(row, "projectId", "/api/jobs"),
		issueKey: readString(row, "issueKey", "/api/jobs"),
		stage: readString(row, "stage", "/api/jobs"),
		status: readString(row, "status", "/api/jobs"),
		createdAt: readString(row, "createdAt", "/api/jobs"),
	};
}

export function parseAgentRecord(payload: unknown): AgentRecord {
	const row = assertObjectRecord(payload, "/api/agents");
	return {
		id: readString(row, "id", "/api/agents"),
		name: readString(row, "name", "/api/agents"),
		description: readString(row, "description", "/api/agents"),
		logo: readString(row, "logo", "/api/agents"),
		runtime: readString(row, "runtime", "/api/agents"),
		backend: readString(row, "backend", "/api/agents"),
		model: readString(row, "model", "/api/agents"),
		reasoningEffort: parseAgentReasoningEffort(row),
		status: parseAgentStatus(row),
		concurrency: readNumber(row, "concurrency", "/api/agents"),
		owner: readString(row, "owner", "/api/agents"),
		createdAt: readString(row, "createdAt", "/api/agents"),
		updatedAt: readString(row, "updatedAt", "/api/agents"),
		skills: readStringArray(row, "skills", "/api/agents"),
		recentWork: readStringArray(row, "recentWork", "/api/agents"),
		activity: readStringArray(row, "activity", "/api/agents"),
		instructions: readString(row, "instructions", "/api/agents"),
	};
}

function parseAgentReasoningEffort(
	row: Record<string, unknown>,
): AgentRecord["reasoningEffort"] {
	const value = readNullableString(row, "reasoningEffort", "/api/agents");
	if (
		value === null ||
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	) {
		return value;
	}
	throw new Error("Invalid /api/agents response field 'reasoningEffort'");
}

function parseAgentStatus(row: Record<string, unknown>): AgentStatus {
	const value = readString(row, "status", "/api/agents");
	if (value === "offline" || value === "online") {
		return value;
	}
	throw new Error("Invalid /api/agents response field 'status'");
}

export function parseSkillRecord(payload: unknown): SkillRecord {
	const row = assertObjectRecord(payload, "/api/skills");
	return {
		id: readString(row, "id", "/api/skills"),
		name: readString(row, "name", "/api/skills"),
		description: readString(row, "description", "/api/skills"),
		source: readString(row, "source", "/api/skills"),
		updatedAt: readString(row, "updatedAt", "/api/skills"),
	};
}

export function parseCommandHistoryRecord(
	payload: unknown,
): CommandHistoryRecord {
	const row = assertObjectRecord(payload, "/api/command-history");
	return {
		id: readString(row, "id", "/api/command-history"),
		command: readString(row, "command", "/api/command-history"),
		exitCode: readNumber(row, "exitCode", "/api/command-history"),
		executedAt: readString(row, "executedAt", "/api/command-history"),
	};
}

export const parseServerList = {
	tokenUsage: (payload: unknown) =>
		parseListResponse(payload, "/api/token-usage", parseTokenUsageRecord),
	jobs: (payload: unknown) =>
		parseListResponse(payload, "/api/jobs", parseJobRecord),
	agents: (payload: unknown) =>
		parseListResponse(payload, "/api/agents", parseAgentRecord),
	skills: (payload: unknown) =>
		parseListResponse(payload, "/api/skills", parseSkillRecord),
	commandHistory: (payload: unknown) =>
		parseListResponse(
			payload,
			"/api/command-history",
			parseCommandHistoryRecord,
		),
};
