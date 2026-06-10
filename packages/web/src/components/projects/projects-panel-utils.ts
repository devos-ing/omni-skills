import type { WorkspaceProjectRecord } from "@/lib/api";
import { sortWorkspaceProjects } from "@/lib/api/project-ordering";
import type { ProjectDisplayRow } from "./types/projects-panel.types";

export {
	DEFAULT_PROJECT_EMOJI,
	EMPTY_PROJECT_FORM_STATE,
	buildProjectCreateRequest,
	buildProjectEditFormState,
	buildProjectUpdateRequest,
} from "./project-form-utils";

const EMPTY_LABEL = "--";
const RELATIVE_TIME_UNITS = [
	{ divisor: 60, limit: 60, suffix: "m" },
	{ divisor: 60 * 60, limit: 24, suffix: "h" },
	{ divisor: 60 * 60 * 24, limit: 7, suffix: "d" },
	{ divisor: 60 * 60 * 24 * 7, limit: 5, suffix: "w" },
	{ divisor: 60 * 60 * 24 * 30, limit: 12, suffix: "mo" },
] as const;

export function filterProjects(
	projects: WorkspaceProjectRecord[],
	searchQuery: string,
): WorkspaceProjectRecord[] {
	const query = searchQuery.trim().toLowerCase();
	if (!query) return projects;
	return projects.filter((project) =>
		projectSearchText(project).toLowerCase().includes(query),
	);
}

export function buildProjectDisplayRows(
	projects: WorkspaceProjectRecord[],
	now = new Date(),
): ProjectDisplayRow[] {
	return sortWorkspaceProjects(projects).map((project) => ({
		project,
		emojiLabel: formatOptionalLabel(project.emoji, "📁"),
		priorityLabel: formatProjectPriority(project.priority),
		categoryLabel: formatOptionalLabel(project.category),
		repositoryLabel: formatProjectRepository(project),
		leadLabel: formatOptionalLabel(project.lead),
		createdLabel: formatProjectCreatedAt(project.createdAt, now),
		summaryLabel: formatOptionalLabel(project.description, project.id),
	}));
}

export function formatProjectPriority(priority: number | null): string {
	return priority === null ? EMPTY_LABEL : `P${priority}`;
}

export function formatProjectRepository(
	project: Pick<WorkspaceProjectRecord, "repoName" | "repoOwner">,
): string {
	const owner = project.repoOwner?.trim();
	const repo = project.repoName?.trim();
	return owner && repo ? `${owner}/${repo}` : owner || repo || EMPTY_LABEL;
}

export function formatProjectCreatedAt(
	createdAt: string,
	now = new Date(),
): string {
	const createdDate = new Date(createdAt);
	if (Number.isNaN(createdDate.getTime())) return EMPTY_LABEL;
	const elapsedMs = Math.max(0, now.getTime() - createdDate.getTime());
	const elapsedSeconds = Math.floor(elapsedMs / 1000);
	if (elapsedSeconds < 60) return "Just now";
	for (const unit of RELATIVE_TIME_UNITS) {
		const value = Math.floor(elapsedSeconds / unit.divisor);
		if (value < unit.limit) return `${value}${unit.suffix} ago`;
	}
	return `${Math.floor(elapsedSeconds / (60 * 60 * 24 * 365))}y ago`;
}

function formatOptionalLabel(
	value: string | null,
	fallback = EMPTY_LABEL,
): string {
	return value?.trim() || fallback;
}

function projectSearchText(project: WorkspaceProjectRecord): string {
	return `${project.name} ${project.emoji ?? ""} ${project.description ?? ""} ${project.externalProjectId ?? ""} ${project.repoOwner ?? ""} ${project.repoName ?? ""} ${project.baseBranch ?? ""} ${project.localFolder ?? ""} ${project.lead ?? ""} ${project.category ?? ""} ${project.priority ?? ""}`;
}
