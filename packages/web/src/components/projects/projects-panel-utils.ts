import type { ProjectCreateRequest, WorkspaceProjectRecord } from "@/lib/api";
import type {
	ProjectCreateDefaults,
	ProjectDisplayRow,
	ProjectFieldGroup,
	ProjectFormState,
} from "./types/projects-panel.types";

const EMPTY_LABEL = "--";

export const EMPTY_PROJECT_FORM_STATE: ProjectFormState = {
	name: "",
	externalProjectId: "",
	description: "",
	repositoryUrl: "",
	localFolder: "",
	lead: "",
	category: "",
	priority: "",
};

export const PROJECT_FORM_FIELD_GROUPS: ProjectFieldGroup[] = [
	{
		title: "Identity",
		fields: [
			{ name: "name", label: "Project name" },
			{ name: "externalProjectId", label: "External project ID" },
			{ name: "description", label: "Description" },
		],
	},
	{
		title: "Repository",
		fields: [
			{
				name: "repositoryUrl",
				label: "Repository URL",
				placeholder: "https://github.com/org/repo",
			},
			{ name: "localFolder", label: "Local folder" },
		],
	},
	{
		title: "Ownership",
		fields: [
			{ name: "lead", label: "Lead" },
			{ name: "category", label: "Category" },
			{ name: "priority", label: "Priority", type: "number" },
		],
	},
];

export function buildProjectCreateRequest(
	form: ProjectFormState,
	defaults: ProjectCreateDefaults,
): ProjectCreateRequest {
	const name = form.name.trim();
	if (!name) {
		throw new Error("Project name is required");
	}
	const repository = parseGitHubRepositoryUrl(form.repositoryUrl);
	return {
		boardId: defaults.boardId,
		ownerId: defaults.ownerId,
		name,
		externalProjectId: optionalText(form.externalProjectId),
		description: optionalText(form.description),
		repoOwner: repository?.owner ?? null,
		repoName: repository?.name ?? null,
		baseBranch: repository ? "main" : null,
		localFolder: optionalText(form.localFolder),
		lead: optionalText(form.lead),
		category: optionalText(form.category),
		priority: optionalPriority(form.priority),
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
	const parsed = Number(trimmed);
	if (!Number.isInteger(parsed)) {
		throw new Error("Priority must be an integer");
	}
	return parsed;
}

function parseGitHubRepositoryUrl(
	value: string,
): { owner: string; name: string } | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}
	const match =
		/^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(trimmed) ??
		/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(trimmed) ??
		/^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(trimmed);
	if (!match) {
		throw new Error("Repository URL must be a GitHub HTTPS or SSH clone URL");
	}
	return { owner: match[1], name: match[2] };
}

function formatOptionalLabel(value: string | null): string {
	return value?.trim() || EMPTY_LABEL;
}

function projectSearchText(project: WorkspaceProjectRecord): string {
	return [
		project.name,
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
