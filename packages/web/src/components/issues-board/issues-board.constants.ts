import type {
	PriorityOption,
	StatusPresentation,
} from "./types/issues-board.types";

export const DEFAULT_WORKSPACE_ID = "owner-1";

export const STATUS_ORDER = [
	"backlog",
	"todo",
	"running",
	"in_review",
	"done",
	"canceled",
] as const;

const NEUTRAL_STATUS_TONE = "border-slate-700/70 bg-surface-panel";

export const STATUS_PRESENTATION: Record<string, StatusPresentation> = {
	backlog: { label: "Backlog", tone: NEUTRAL_STATUS_TONE },
	todo: { label: "To Do", tone: NEUTRAL_STATUS_TONE },
	running: { label: "Running", tone: NEUTRAL_STATUS_TONE },
	in_review: { label: "In Review", tone: NEUTRAL_STATUS_TONE },
	done: { label: "Done", tone: NEUTRAL_STATUS_TONE },
	canceled: { label: "Canceled", tone: NEUTRAL_STATUS_TONE },
};

export const PRIORITY_OPTIONS: readonly PriorityOption[] = [
	{ value: 1, label: "Urgent" },
	{ value: 2, label: "High" },
	{ value: 3, label: "Medium" },
	{ value: 4, label: "Low" },
	{ value: 0, label: "No priority" },
];
