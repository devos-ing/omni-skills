import { resolveSessionActivity } from "./chat-session-activity-resolver";
import type {
	ChatMissionLogLine,
	ChatMissionProgressViewModel,
} from "./types/chat-mission-progress.types";
import type { ChatStreamLine } from "./types/chat-room.types";
import type {
	ChatSessionActivityDetail,
	ChatSessionActivitySection,
} from "./types/chat-session-activity.types";

const ACTIVE_MISSION_STATUSES = new Set(["in_progress", "in_review"]);
const MAX_SECTION_DETAILS = 8;
const MAX_SECTIONS = 6;

interface CreateChatSessionActivityInput {
	missionProgress: ChatMissionProgressViewModel | null;
	streamLines: ChatStreamLine[];
}

interface ActivityEvent {
	id: string;
	source: "mission" | "stream";
	text: string;
}

export function createChatSessionActivitySections({
	missionProgress,
	streamLines,
}: CreateChatSessionActivityInput): ChatSessionActivitySection[] {
	const sections: ChatSessionActivitySection[] = [];
	const sectionById = new Map<string, ChatSessionActivitySection>();
	for (const event of activityEvents({ missionProgress, streamLines })) {
		const activity = resolveSessionActivity(event.text);
		if (!activity) continue;
		const sectionId = `${activity.kind}:${slugId(activity.summary)}`;
		const detail = activityDetail(event, activity.kind, activity.detailText);
		const existing = sectionById.get(sectionId);
		if (existing) {
			existing.details = [...existing.details, detail].slice(
				-MAX_SECTION_DETAILS,
			);
			continue;
		}
		const section = {
			details: [detail],
			id: sectionId,
			kind: activity.kind,
			summary: activity.summary,
		};
		sections.push(section);
		sectionById.set(sectionId, section);
	}
	return sections.slice(-MAX_SECTIONS);
}

function activityEvents({
	missionProgress,
	streamLines,
}: CreateChatSessionActivityInput): ActivityEvent[] {
	const events = streamLines.map((line) => ({
		id: line.id,
		source: "stream" as const,
		text: line.text,
	}));
	if (!shouldShowMissionActivity(missionProgress)) return events;
	return [
		...events,
		...missionProgress.latestLogLines.map((line) => missionEvent(line)),
	];
}

function shouldShowMissionActivity(
	missionProgress: ChatMissionProgressViewModel | null,
): missionProgress is ChatMissionProgressViewModel {
	if (!isActiveMission(missionProgress)) return false;
	return missionProgress.phases.some((phase) => phase.status === "running");
}

function missionEvent(line: ChatMissionLogLine): ActivityEvent {
	return {
		id: line.id,
		source: "mission",
		text: line.text,
	};
}

function activityDetail(
	event: ActivityEvent,
	kind: string,
	text: string,
): ChatSessionActivityDetail {
	return {
		id: `${event.source}:${event.id}:${kind}`,
		text,
	};
}

function isActiveMission(
	missionProgress: ChatMissionProgressViewModel | null,
): missionProgress is ChatMissionProgressViewModel {
	if (!missionProgress || missionProgress.state !== "ready") return false;
	return ACTIVE_MISSION_STATUSES.has(missionProgress.status.toLowerCase());
}

function slugId(value: string): string {
	const slug = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "activity";
}
