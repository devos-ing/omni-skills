"use client";

import { Plus, X } from "lucide-react";
import type { ChangeEvent, FormEvent, ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PROJECT_FORM_FIELD_GROUPS } from "./projects-panel-utils";
import type { ProjectFormState } from "./types/projects-panel.types";

interface ProjectCreateDialogProps {
	form: ProjectFormState;
	formError: string | null;
	isSaving: boolean;
	onClose: () => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onUpdateField: (
		field: keyof ProjectFormState,
		event: ChangeEvent<HTMLInputElement>,
	) => void;
}

export function ProjectCreateDialog({
	form,
	formError,
	isSaving,
	onClose,
	onSubmit,
	onUpdateField,
}: ProjectCreateDialogProps): ReactElement {
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="grid max-h-[min(46rem,calc(100dvh-2rem))] max-w-2xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden bg-[#17181c] p-0"
				showCloseButton={false}
			>
				<DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-zinc-800 px-4 py-3 text-left">
					<div className="min-w-0">
						<DialogTitle className="truncate text-base">
							New project
						</DialogTitle>
					</div>
					<Button
						aria-label="Close"
						className="shrink-0"
						onClick={onClose}
						size="icon"
						type="button"
						variant="ghost"
					>
						<X size={16} />
					</Button>
				</DialogHeader>
				<form
					className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden"
					onSubmit={onSubmit}
				>
					<div className="grid content-start gap-4 overflow-auto p-4">
						{PROJECT_FORM_FIELD_GROUPS.map((group) => (
							<fieldset
								className="grid gap-3 border-0 border-t border-zinc-800 p-0 pt-4 first:border-t-0 first:pt-0"
								key={group.title}
							>
								<legend className="mb-1 text-sm font-medium text-zinc-300">
									{group.title}
								</legend>
								<div className="grid gap-3 sm:grid-cols-2">
									{group.fields.map((field) => (
										<label
											className="grid gap-1 text-sm"
											htmlFor={`project-create-${field.name}`}
											key={field.name}
										>
											<span className="text-zinc-400">{field.label}</span>
											<Input
												id={`project-create-${field.name}`}
												name={field.name}
												placeholder={field.placeholder}
												type={field.type ?? "text"}
												value={form[field.name]}
												onChange={(event) => onUpdateField(field.name, event)}
											/>
										</label>
									))}
								</div>
							</fieldset>
						))}
						{formError ? (
							<p className="m-0 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">
								{formError}
							</p>
						) : null}
					</div>
					<footer className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800 px-4 py-3">
						<Button
							onClick={onClose}
							size="sm"
							type="button"
							variant="secondary"
						>
							Cancel
						</Button>
						<Button disabled={isSaving} size="sm" type="submit">
							<Plus size={15} />
							Create project
						</Button>
					</footer>
				</form>
			</DialogContent>
		</Dialog>
	);
}
