"use client";

import { type FormEvent, type ReactElement, useMemo, useState } from "react";

import {
	useCreateProjectMutation,
	useCurrentWorkspaceQuery,
	useUpdateProjectMutation,
} from "@/lib/api/queries";
import {
	useGitHubConnectionQuery,
	useGitHubRepositoriesQuery,
	useWorkspaceProjectsQuery,
} from "@/lib/api/realtime-queries";

import { ProjectFormDialog } from "./project-form-dialog";
import {
	EMPTY_PROJECT_FORM_STATE,
	buildProjectCreateRequest,
	buildProjectEditFormState,
	buildProjectUpdateRequest,
} from "./project-form-utils";
import { connectGitHubForProjects } from "./project-github-oauth";
import { ProjectsPanelHeader } from "./projects-panel-header";
import {
	buildProjectDisplayRows,
	filterProjects,
} from "./projects-panel-utils";
import { ProjectsTable } from "./projects-table";
import type {
	ProjectDialogMode,
	ProjectDisplayRow,
	ProjectFormFieldName,
	ProjectFormState,
	ProjectRepositorySelection,
} from "./types/projects-panel.types";

const LOCAL_BOARD_ID = "board-1";

export function ProjectsPanel(): ReactElement {
	const [form, setForm] = useState<ProjectFormState>({
		...EMPTY_PROJECT_FORM_STATE,
	});
	const [formError, setFormError] = useState<string | null>(null);
	const [dialogMode, setDialogMode] = useState<ProjectDialogMode | null>(null);
	const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const currentWorkspaceQuery = useCurrentWorkspaceQuery({
		refetchIntervalMs: false,
	});
	const workspaceId = currentWorkspaceQuery.data?.workspaceId ?? "";
	const projectsQuery = useWorkspaceProjectsQuery(workspaceId, {
		refetchIntervalMs: false,
	});
	const gitHubConnectionQuery = useGitHubConnectionQuery({
		enabled: Boolean(dialogMode),
		refetchIntervalMs: false,
	});
	const repositoriesQuery = useGitHubRepositoriesQuery({
		enabled:
			Boolean(dialogMode) && gitHubConnectionQuery.data?.isConnected === true,
		refetchIntervalMs: false,
	});
	const createProject = useCreateProjectMutation();
	const updateProject = useUpdateProjectMutation();
	const projects = projectsQuery.data ?? [];
	const repositories = repositoriesQuery.data?.repositories ?? [];
	const filteredProjects = useMemo(
		() => filterProjects(projects, searchQuery),
		[projects, searchQuery],
	);
	const projectRows = useMemo(
		() => buildProjectDisplayRows(filteredProjects),
		[filteredProjects],
	);
	const projectsWithRepository = projects.filter(
		(project) => project.repoOwner && project.repoName,
	).length;

	function updateField(field: ProjectFormFieldName, value: string): void {
		setForm((current) => ({ ...current, [field]: value }));
	}

	function updateRepositoryQuery(value: string): void {
		setForm((current) => ({
			...current,
			repositoryQuery: value,
			repositorySelection:
				current.repositorySelection?.fullName === value.trim()
					? current.repositorySelection
					: null,
		}));
	}

	function updateRepositorySelection(
		selection: ProjectRepositorySelection | null,
	): void {
		setForm((current) => ({ ...current, repositorySelection: selection }));
	}

	function openCreateDialog(): void {
		setForm({ ...EMPTY_PROJECT_FORM_STATE });
		setFormError(null);
		setEditingProjectId(null);
		setDialogMode("create");
	}

	function openEditDialog(row: ProjectDisplayRow): void {
		setForm(buildProjectEditFormState(row.project));
		setFormError(null);
		setEditingProjectId(row.project.id);
		setDialogMode("edit");
	}

	function closeProjectDialog(): void {
		setDialogMode(null);
		setFormError(null);
		setEditingProjectId(null);
	}

	function toggleProjectPin(row: ProjectDisplayRow): void {
		updateProject.mutate({
			projectId: row.project.id,
			project: { isPinned: !row.project.isPinned },
		});
	}

	function retryGitHubData(): void {
		void gitHubConnectionQuery.refetch().then((result) => {
			if (result.data?.isConnected === true) void repositoriesQuery.refetch();
		});
	}

	async function submitProject(
		event: FormEvent<HTMLFormElement>,
	): Promise<void> {
		event.preventDefault();
		setFormError(null);
		if (!dialogMode) return;
		if (!workspaceId) {
			setFormError("Workspace is still loading.");
			return;
		}
		try {
			if (dialogMode === "edit") {
				if (!editingProjectId) {
					setFormError("Project is not selected.");
					return;
				}
				await updateProject.mutateAsync({
					projectId: editingProjectId,
					project: buildProjectUpdateRequest(form, repositories),
				});
			} else {
				await createProject.mutateAsync(
					buildProjectCreateRequest(
						form,
						{ boardId: LOCAL_BOARD_ID, ownerId: workspaceId },
						repositories,
					),
				);
			}
			setForm({ ...EMPTY_PROJECT_FORM_STATE });
			setEditingProjectId(null);
			setDialogMode(null);
		} catch (error) {
			setFormError(
				error instanceof Error ? error.message : "Project save failed",
			);
		}
	}

	return (
		<section className="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] min-h-[28rem] flex-col overflow-hidden rounded-lg border border-border bg-card text-zinc-100">
			<ProjectsPanelHeader
				canCreate={Boolean(workspaceId)}
				filteredCount={filteredProjects.length}
				isWorkspaceLoading={currentWorkspaceQuery.isLoading}
				projectCount={projects.length}
				projectsWithRepository={projectsWithRepository}
				searchQuery={searchQuery}
				onCreateProject={openCreateDialog}
				onRefreshProjects={() => void projectsQuery.refetch()}
				onSearchChange={setSearchQuery}
			/>
			<div className="min-h-0 overflow-auto">
				<ProjectsTable
					error={projectsQuery.error}
					isLoading={projectsQuery.isLoading}
					rows={projectRows}
					searchQuery={searchQuery}
					totalCount={projects.length}
					onEditProject={openEditDialog}
					onToggleProjectPin={toggleProjectPin}
				/>
			</div>
			{dialogMode ? (
				<ProjectFormDialog
					connection={gitHubConnectionQuery.data}
					form={form}
					formError={formError}
					isConnectionError={gitHubConnectionQuery.isError}
					isConnectionLoading={
						gitHubConnectionQuery.isLoading || gitHubConnectionQuery.isFetching
					}
					isRepositoryError={repositoriesQuery.isError}
					isRepositoryLoading={
						repositoriesQuery.isLoading || repositoriesQuery.isFetching
					}
					isSaving={createProject.isPending || updateProject.isPending}
					mode={dialogMode}
					repositories={repositories}
					repositoryUnavailableReason={
						repositoriesQuery.data?.unavailableReason ?? null
					}
					onClose={closeProjectDialog}
					onConnectGitHub={connectGitHubForProjects}
					onRepositoryQueryChange={updateRepositoryQuery}
					onRepositorySelectionChange={updateRepositorySelection}
					onRetryRepositories={retryGitHubData}
					onSubmit={(event) => void submitProject(event)}
					onUpdateField={updateField}
				/>
			) : null}
		</section>
	);
}
