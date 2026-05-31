"use client";

import { Plus, RefreshCw, Search } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import {
	useCreateProjectMutation,
	useCurrentWorkspaceQuery,
	useUpdateProjectMutation,
} from "@/lib/api/queries";
import {
	useGitHubRepositoriesQuery,
	useWorkspaceProjectsQuery,
} from "@/lib/api/realtime-queries";

import { ProjectCreateDialog } from "./project-create-dialog";
import {
	EMPTY_PROJECT_FORM_STATE,
	buildProjectCreateRequest,
	buildProjectDisplayRows,
	buildProjectEditFormState,
	buildProjectUpdateRequest,
	filterProjects,
} from "./projects-panel-utils";
import { ProjectsTable } from "./projects-table";
import type {
	ProjectDisplayRow,
	ProjectFormState,
} from "./types/projects-panel.types";

const LOCAL_BOARD_ID = "board-1";

export function ProjectsPanel(): ReactElement {
	const [form, setForm] = useState<ProjectFormState>({
		...EMPTY_PROJECT_FORM_STATE,
	});
	const [formError, setFormError] = useState<string | null>(null);
	const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
	const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const currentWorkspaceQuery = useCurrentWorkspaceQuery({
		refetchIntervalMs: false,
	});
	const workspaceId = currentWorkspaceQuery.data?.workspaceId ?? "";
	const projectsQuery = useWorkspaceProjectsQuery(workspaceId, {
		refetchIntervalMs: false,
	});
	const repositoriesQuery = useGitHubRepositoriesQuery({
		enabled: Boolean(dialogMode),
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

	function updateField(field: keyof ProjectFormState, value: string): void {
		setForm((current) => ({ ...current, [field]: value }));
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

	async function submitProject(
		event: FormEvent<HTMLFormElement>,
	): Promise<void> {
		event.preventDefault();
		setFormError(null);
		if (!dialogMode) {
			return;
		}
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
						{
							boardId: LOCAL_BOARD_ID,
							ownerId: workspaceId,
						},
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
			<header className="grid gap-4 border-b border-border p-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2">
						<Typography className="truncate" variant="pageTitle">
							Projects
						</Typography>
						<Typography variant="description">{projects.length}</Typography>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							aria-label="Refresh projects"
							onClick={() => void projectsQuery.refetch()}
							size="icon"
							type="button"
							variant="ghost"
						>
							<RefreshCw size={16} />
						</Button>
						<Button
							disabled={!workspaceId || currentWorkspaceQuery.isLoading}
							onClick={openCreateDialog}
							size="sm"
							type="button"
						>
							<Plus size={16} />
							New project
						</Button>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<label
						className="relative min-w-[16rem] flex-1"
						htmlFor="projects-search"
					>
						<Search
							className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
							size={16}
						/>
						<Input
							aria-label="Search projects"
							className="h-11 pl-9 text-base"
							id="projects-search"
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder="Search projects..."
							value={searchQuery}
						/>
					</label>
					<Typography className="text-sm text-zinc-400">
						{filteredProjects.length} of {projects.length}
					</Typography>
				</div>
				<div className="flex flex-wrap gap-2">
					<ProjectMetric label="All" value={projects.length} />
					<ProjectMetric label="With repo" value={projectsWithRepository} />
					<ProjectMetric
						label="Missing repo"
						value={projects.length - projectsWithRepository}
					/>
				</div>
			</header>
			<div className="min-h-0 overflow-auto">
				<ProjectsTable
					error={projectsQuery.error}
					isLoading={projectsQuery.isLoading}
					rows={projectRows}
					searchQuery={searchQuery}
					totalCount={projects.length}
					onEditProject={openEditDialog}
				/>
			</div>
			{dialogMode ? (
				<ProjectCreateDialog
					form={form}
					formError={formError}
					isRepositoryLoading={repositoriesQuery.isLoading}
					isSaving={createProject.isPending || updateProject.isPending}
					mode={dialogMode}
					repositories={repositories}
					repositoryUnavailableReason={
						repositoriesQuery.data?.unavailableReason ?? null
					}
					onClose={closeProjectDialog}
					onSubmit={(event) => void submitProject(event)}
					onUpdateField={updateField}
				/>
			) : null}
		</section>
	);
}

function ProjectMetric({
	label,
	value,
}: {
	label: string;
	value: number;
}): ReactElement {
	return (
		<span className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-zinc-400">
			{label}
			<Typography as="span" className="text-zinc-100">
				{value}
			</Typography>
		</span>
	);
}
