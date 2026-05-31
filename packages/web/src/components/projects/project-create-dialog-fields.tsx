"use client";

import { FolderGit, Keyboard, Search } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import type { GitHubRepositoryRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

import type {
	ProjectFormState,
	ProjectRepositoryMode,
} from "./types/projects-panel.types";

export function RepositoryFields({
	form,
	hasRepositoryOptions,
	isRepositoryLoading,
	repositories,
	repositoryUnavailableReason,
	onUpdateField,
}: {
	form: ProjectFormState;
	hasRepositoryOptions: boolean;
	isRepositoryLoading: boolean;
	repositories: GitHubRepositoryRecord[];
	repositoryUnavailableReason: string | null;
	onUpdateField: (field: keyof ProjectFormState, value: string) => void;
}): ReactElement {
	return (
		<fieldset className="grid gap-3 border-0 border-t border-border p-0 pt-4">
			<Typography as="legend" className="mb-1" variant="label">
				GitHub repository
			</Typography>
			<div className="flex flex-wrap gap-2">
				<RepositoryModeButton
					icon={<FolderGit size={15} />}
					isActive={form.repositoryMode === "select"}
					label="Select"
					mode="select"
					onSelect={(mode) => onUpdateField("repositoryMode", mode)}
				/>
				<RepositoryModeButton
					icon={<Keyboard size={15} />}
					isActive={form.repositoryMode === "manual"}
					label="Manual"
					mode="manual"
					onSelect={(mode) => onUpdateField("repositoryMode", mode)}
				/>
			</div>
			{form.repositoryMode === "select" ? (
				<label className="grid gap-1" htmlFor="project-create-repository">
					<span className="sr-only">Repository</span>
					<select
						className="h-10 rounded-md border border-input bg-surface-input px-3 text-sm text-zinc-100 outline-none transition focus-visible:border-zinc-500 focus-visible:ring-2 focus-visible:ring-ring"
						disabled={!hasRepositoryOptions}
						id="project-create-repository"
						onChange={(event) =>
							onUpdateField("selectedRepository", event.target.value)
						}
						value={form.selectedRepository}
					>
						<option value="">
							{isRepositoryLoading ? "Loading repositories" : "No repository"}
						</option>
						{repositories.map((repository) => (
							<option key={repository.id} value={repository.nameWithOwner}>
								{repository.nameWithOwner}
							</option>
						))}
					</select>
				</label>
			) : (
				<Field
					htmlFor="project-create-manual-repository"
					label="Manual repository"
				>
					<div className="relative">
						<Search
							className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
							size={16}
						/>
						<Input
							className="pl-9"
							id="project-create-manual-repository"
							onChange={(event) =>
								onUpdateField("manualRepository", event.target.value)
							}
							placeholder="owner/repo"
							value={form.manualRepository}
						/>
					</div>
				</Field>
			)}
			{repositoryUnavailableReason ? (
				<Typography variant="description">
					{repositoryUnavailableReason}; manual entry is still available.
				</Typography>
			) : null}
		</fieldset>
	);
}

export function Field({
	children,
	htmlFor,
	label,
}: {
	children: ReactElement;
	htmlFor?: string;
	label: string;
}): ReactElement {
	return (
		<div className="grid gap-1">
			<Typography
				as="label"
				className="text-zinc-400"
				htmlFor={htmlFor}
				variant="label"
			>
				{label}
			</Typography>
			{children}
		</div>
	);
}

function RepositoryModeButton({
	icon,
	isActive,
	label,
	mode,
	onSelect,
}: {
	icon: ReactElement;
	isActive: boolean;
	label: string;
	mode: ProjectRepositoryMode;
	onSelect: (mode: ProjectRepositoryMode) => void;
}): ReactElement {
	return (
		<Button
			aria-pressed={isActive}
			className={cn(isActive ? "border-zinc-500 bg-surface-active" : "")}
			onClick={() => onSelect(mode)}
			size="sm"
			type="button"
			variant="outline"
		>
			{icon}
			{label}
		</Button>
	);
}
