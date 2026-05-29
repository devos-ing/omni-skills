import type { TaskActivityStepRecord } from "@/lib/api";

export type ChatMissionProgressState = "loading" | "error" | "ready";

export interface ChatMissionNote {
	id: string;
	actorId: string;
	body: string;
	createdAt: string;
	title: string;
}

export interface ChatMissionLogLine {
	emittedAt?: string;
	id: string;
	phaseId?: ChatMissionPhaseId;
	stream: "stdout" | "stderr" | "system";
	text: string;
}

export type ChatMissionPhaseId = "plan" | "implement" | "testing" | "qa";

export type ChatMissionPhaseStatus =
	| "pending"
	| "running"
	| "success"
	| "failed"
	| "warning";

export interface ChatMissionPhase {
	id: ChatMissionPhaseId;
	label: string;
	status: ChatMissionPhaseStatus;
}

export interface ChatMissionExecution {
	id: string;
	body: string;
	logLines: ChatMissionLogLine[];
	startedAt: string;
	status: string | null;
	steps: TaskActivityStepRecord[];
	title: string;
}

export interface ChatMissionResult {
	label: string;
	tone: "success" | "error" | "running" | "warning" | "neutral";
}

export interface ChatMissionUsageSummary {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	estimatedCostMicrousd: number | null;
	runs: number;
}

export interface ChatMissionProgressViewModel {
	state: ChatMissionProgressState;
	taskId: string;
	taskKey: string;
	title: string;
	status: string;
	statusLabel: string;
	updatedAt: string;
	notes: ChatMissionNote[];
	executions: ChatMissionExecution[];
	latestLogLines: ChatMissionLogLine[];
	latestResult: ChatMissionResult | null;
	usageSummary: ChatMissionUsageSummary | null;
	phaseLogLines: Record<ChatMissionPhaseId, ChatMissionLogLine[]>;
	phases: ChatMissionPhase[];
	errorMessage?: string;
}
