"use client";

import { LayoutGrid, List, Plus, RefreshCw, Search } from "lucide-react";
import type { ChangeEvent, FormEvent, ReactElement } from "react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	useCreateProjectMutation,
	useCurrentWorkspaceQuery,
} from "@/lib/api/queries";
import { useWorkspaceProjectsQuery } from "@/lib/api/realtime-queries";
import { cn } from "@/lib/utils";

import { ProjectCreateDialog } from "./project-create-dialog";
import {
	EMPTY_PROJECT_FORM_STATE,
	buildProjectCreateRequest,
	buildProjectDisplayRows,
	filterProjects,
} from "./projects-panel-utils";
import { ProjectsTable } from "./projects-table";
import type {
	ProjectFormState,
	ProjectTableDensity,
} from "./types/projects-panel.types";

const LOCAL_BOARD_ID = "board-1";

export function ProjectsPanel(): ReactElement {
	const [form, setForm] = useState<ProjectFormState>({
		...EMPTY_PROJECT_FORM_STATE,
	});
	const [formError, setFormError] = useState<string | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [density, setDensity] = useState<ProjectTableDensity>("compact");
	const currentWorkspaceQuery = useCurrentWorkspaceQuery({
		refetchIntervalMs: false,
	});
	const workspaceId = currentWorkspaceQuery.data?.workspaceId ?? "";
	const projectsQuery = useWorkspaceProjectsQuery(workspaceId, {
		refetchIntervalMs: false,
	});
	const createProject = useCreateProjectMutation();
	const projects = projectsQuery.data ?? [];
	const filteredProjects = useMemo(
		() => filterProjects(projects, searchQuery),
		[projects, searchQuery],
	);
	const projectRows = useMemo(
		() => buildProjectDisplayRows(filteredProjects),
		[filteredProjects],
	);

	function updateField(
		field: keyof ProjectFormState,
		event: ChangeEvent<HTMLInputElement>,
	): void {
		setForm((current) => ({ ...current, [field]: event.target.value }));
	}

	function openCreateDialog(): void {
		setFormError(null);
		setIsCreateOpen(true);
	}

	function closeCreateDialog(): void {
		setIsCreateOpen(false);
		setFormError(null);
	}

	async function submitProject(
		event: FormEvent<HTMLFormElement>,
	): Promise<void> {
		event.preventDefault();
		setFormError(null);
		if (!workspaceId) {
			setFormError("Workspace is still loading.");
			return;
		}
		try {
			await createProject.mutateAsync(
				buildProjectCreateRequest(form, {
					boardId: LOCAL_BOARD_ID,
					ownerId: workspaceId,
				}),
			);
			setForm({ ...EMPTY_PROJECT_FORM_STATE });
			setIsCreateOpen(false);
		} catch (error) {
			setFormError(
				error instanceof Error ? error.message : "Project save failed",
			);
		}
	}

	return (
		<section className="grid h-[100dvh] max-h-[100dvh] min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden bg-[#0f1013] text-zinc-100">
			<header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900 bg-[#111216] px-5 py-4">
				<div className="flex min-w-0 items-center gap-2">
					<h1 className="m-0 truncate text-xl font-semibold">Projects</h1>
					<span className="text-sm text-zinc-500">{projects.length}</span>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						aria-label="Refresh projects"
						onClick={() => void projectsQuery.refetch()}
						size="icon"
						variant="ghost"
						type="button"
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
			</header>
			<ProjectToolbar
				density={density}
				filteredCount={filteredProjects.length}
				searchQuery={searchQuery}
				totalCount={projects.length}
				onDensityChange={setDensity}
				onSearchChange={setSearchQuery}
			/>
			<div className="min-h-0 p-5 pt-4">
				<ProjectsTable
					density={density}
					error={projectsQuery.error}
					isLoading={projectsQuery.isLoading}
					rows={projectRows}
					searchQuery={searchQuery}
					totalCount={projects.length}
				/>
			</div>
			{isCreateOpen ? (
				<ProjectCreateDialog
					form={form}
					formError={formError}
					isSaving={createProject.isPending}
					onClose={closeCreateDialog}
					onSubmit={(event) => void submitProject(event)}
					onUpdateField={updateField}
				/>
			) : null}
		</section>
	);
}

function ProjectToolbar({
	density,
	filteredCount,
	searchQuery,
	totalCount,
	onDensityChange,
	onSearchChange,
}: {
	density: ProjectTableDensity;
	filteredCount: number;
	searchQuery: string;
	totalCount: number;
	onDensityChange: (density: ProjectTableDensity) => void;
	onSearchChange: (value: string) => void;
}): ReactElement {
	return (
		<div className="flex flex-wrap items-center gap-3 border-b border-zinc-900 px-5 py-3">
			<label
				className="relative min-w-60 flex-1 sm:max-w-sm"
				htmlFor="projects-search"
			>
				<Search
					className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
					size={16}
				/>
				<Input
					aria-label="Search projects"
					className="pl-9"
					id="projects-search"
					onChange={(event) => onSearchChange(event.target.value)}
					placeholder="Search projects..."
					value={searchQuery}
				/>
			</label>
			<div className="ml-auto flex flex-wrap items-center gap-3">
				<span className="whitespace-nowrap text-sm text-zinc-500">
					{filteredCount} / {totalCount}
				</span>
				<div className="inline-flex rounded-lg border border-zinc-800 bg-[#18191d] p-1">
					<DensityButton
						density="compact"
						icon={<List size={15} />}
						isActive={density === "compact"}
						label="Compact"
						onSelect={onDensityChange}
					/>
					<DensityButton
						density="comfortable"
						icon={<LayoutGrid size={15} />}
						isActive={density === "comfortable"}
						label="Comfortable"
						onSelect={onDensityChange}
					/>
				</div>
			</div>
		</div>
	);
}

function DensityButton({
	density,
	icon,
	isActive,
	label,
	onSelect,
}: {
	density: ProjectTableDensity;
	icon: ReactElement;
	isActive: boolean;
	label: string;
	onSelect: (density: ProjectTableDensity) => void;
}): ReactElement {
	return (
		<Button
			className={cn(
				"h-8 gap-2 px-2.5",
				isActive
					? "bg-zinc-800 text-zinc-100"
					: "text-zinc-500 hover:text-zinc-200",
			)}
			onClick={() => onSelect(density)}
			size="sm"
			type="button"
			variant="ghost"
		>
			{icon}
			<span>{label}</span>
		</Button>
	);
}
