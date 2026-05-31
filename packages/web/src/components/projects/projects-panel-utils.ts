import type {
	GitHubRepositoryRecord,
	ProjectCreateRequest,
	ProjectUpdateRequest,
	WorkspaceProjectRecord,
} from "@/lib/api";
import type {
	ProjectCreateDefaults,
	ProjectDisplayRow,
	ProjectFormState,
} from "./types/projects-panel.types";

const EMPTY_LABEL = "--";
export const DEFAULT_PROJECT_EMOJI = "📁";

export const EMPTY_PROJECT_FORM_STATE: ProjectFormState = {
	name: "",
	emoji: DEFAULT_PROJECT_EMOJI,
	description: "",
	repositoryMode: "select",
	selectedRepository: "",
	manualRepository: "",
	lead: "",
	priority: "",
};

export function buildProjectCreateRequest(
	form: ProjectFormState,
	defaults: ProjectCreateDefaults,
	repositories: GitHubRepositoryRecord[] = [],
): ProjectCreateRequest {
	const name = form.name.trim();
	if (!name) {
		throw new Error("Project name is required");
	}
	const repository = resolveRepository(form, repositories);
	return {
		boardId: defaults.boardId,
		ownerId: defaults.ownerId,
		name,
		emoji: optionalText(form.emoji) ?? DEFAULT_PROJECT_EMOJI,
		externalProjectId: null,
		description: optionalText(form.description),
		repoOwner: repository?.owner ?? null,
		repoName: repository?.name ?? null,
		baseBranch: repository?.defaultBranch ?? null,
		localFolder: null,
		lead: optionalText(form.lead),
		category: null,
		priority: optionalPriority(form.priority),
	};
}

export function buildProjectUpdateRequest(
	form: ProjectFormState,
	repositories: GitHubRepositoryRecord[] = [],
): ProjectUpdateRequest {
	const name = form.name.trim();
	if (!name) {
		throw new Error("Project name is required");
	}
	const repository = resolveRepository(form, repositories);
	return {
		name,
		emoji: optionalText(form.emoji) ?? DEFAULT_PROJECT_EMOJI,
		description: optionalText(form.description),
		repoOwner: repository?.owner ?? null,
		repoName: repository?.name ?? null,
		baseBranch: repository?.defaultBranch ?? null,
		lead: optionalText(form.lead),
		priority: optionalPriority(form.priority),
	};
}

export function buildProjectEditFormState(
	project: WorkspaceProjectRecord,
): ProjectFormState {
	const manualRepository =
		project.repoOwner && project.repoName
			? `${project.repoOwner}/${project.repoName}`
			: "";
	return {
		...EMPTY_PROJECT_FORM_STATE,
		name: project.name,
		emoji: project.emoji ?? DEFAULT_PROJECT_EMOJI,
		description: project.description ?? "",
		repositoryMode: "manual",
		manualRepository,
		lead: project.lead ?? "",
		priority: project.priority === null ? "" : String(project.priority),
	};
}

export function filterProjects(
	projects: WorkspaceProjectRecord[],
	searchQuery: string,
): WorkspaceProjectRecord[] {
	const query = searchQuery.trim().toLowerCase();
	if (!query) {
		return projects;
	}
	return projects.filter((project) =>
		projectSearchText(project).toLowerCase().includes(query),
	);
}

export function buildProjectDisplayRows(
	projects: WorkspaceProjectRecord[],
	now = new Date(),
): ProjectDisplayRow[] {
	return projects.map((project) => ({
		project,
		emojiLabel: formatOptionalLabel(project.emoji, DEFAULT_PROJECT_EMOJI),
		priorityLabel: formatProjectPriority(project.priority),
		categoryLabel: formatOptionalLabel(project.category),
		repositoryLabel: formatProjectRepository(project),
		leadLabel: formatOptionalLabel(project.lead),
		createdLabel: formatProjectCreatedAt(project.createdAt, now),
		summaryLabel:
			formatOptionalLabel(project.description) === EMPTY_LABEL
				? project.id
				: formatOptionalLabel(project.description),
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
	if (owner && repo) {
		return `${owner}/${repo}`;
	}
	return owner || repo || EMPTY_LABEL;
}

export function formatProjectCreatedAt(
	createdAt: string,
	now = new Date(),
): string {
	const createdDate = new Date(createdAt);
	if (Number.isNaN(createdDate.getTime())) {
		return EMPTY_LABEL;
	}
	const elapsedMs = Math.max(0, now.getTime() - createdDate.getTime());
	const elapsedSeconds = Math.floor(elapsedMs / 1000);
	if (elapsedSeconds < 60) {
		return "Just now";
	}
	const elapsedMinutes = Math.floor(elapsedSeconds / 60);
	if (elapsedMinutes < 60) {
		return `${elapsedMinutes}m ago`;
	}
	const elapsedHours = Math.floor(elapsedMinutes / 60);
	if (elapsedHours < 24) {
		return `${elapsedHours}h ago`;
	}
	const elapsedDays = Math.floor(elapsedHours / 24);
	if (elapsedDays < 7) {
		return `${elapsedDays}d ago`;
	}
	const elapsedWeeks = Math.floor(elapsedDays / 7);
	if (elapsedWeeks < 5) {
		return `${elapsedWeeks}w ago`;
	}
	const elapsedMonths = Math.floor(elapsedDays / 30);
	if (elapsedMonths < 12) {
		return `${elapsedMonths}mo ago`;
	}
	return `${Math.floor(elapsedDays / 365)}y ago`;
}

function optionalText(value: string): string | null {
	const trimmed = value.trim();
	return trimmed || null;
}

function optionalPriority(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}
	const priority = Number(trimmed);
	if (!Number.isInteger(priority)) {
		throw new Error("Priority must be a whole number");
	}
	return priority;
}

function resolveRepository(
	form: ProjectFormState,
	repositories: GitHubRepositoryRecord[],
): { owner: string; name: string; defaultBranch: string } | null {
	const selected =
		form.repositoryMode === "manual"
			? form.manualRepository
			: form.selectedRepository;
	const trimmed = selected.trim();
	if (!trimmed) {
		return null;
	}
	const repository = repositories.find(
		(option) => option.nameWithOwner === trimmed,
	);
	if (repository) {
		return {
			owner: repository.owner,
			name: repository.name,
			defaultBranch: repository.defaultBranch ?? "main",
		};
	}
	const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(trimmed);
	if (!match) {
		throw new Error("Repository must be owner/repo");
	}
	return { owner: match[1], name: match[2], defaultBranch: "main" };
}

function formatOptionalLabel(
	value: string | null,
	fallback = EMPTY_LABEL,
): string {
	return value?.trim() || fallback;
}

function projectSearchText(project: WorkspaceProjectRecord): string {
	return [
		project.name,
		project.emoji,
		project.description,
		project.externalProjectId,
		project.repoOwner,
		project.repoName,
		project.baseBranch,
		project.localFolder,
		project.lead,
		project.category,
		project.priority === null ? null : String(project.priority),
	]
		.filter(Boolean)
		.join(" ");
}
