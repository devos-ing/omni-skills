"use client";

import { Plus, X } from "lucide-react";
import type { ChangeEvent, FormEvent, ReactElement } from "react";

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
		<div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4">
			<button
				aria-label="Close project dialog"
				className="absolute inset-0 h-full w-full cursor-default bg-transparent p-0"
				onClick={onClose}
				type="button"
			/>
			<section
				aria-labelledby="project-create-title"
				className="relative z-10 grid max-h-[min(46rem,calc(100dvh-2rem))] w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-zinc-800 bg-[#17181c] shadow-2xl"
			>
				<header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
					<div className="min-w-0">
						<h2
							className="m-0 truncate text-base font-semibold text-zinc-100"
							id="project-create-title"
						>
							New project
						</h2>
					</div>
					<button
						aria-label="Close"
						className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
						onClick={onClose}
						type="button"
					>
						<X size={16} />
					</button>
				</header>
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
										<label className="grid gap-1 text-sm" key={field.name}>
											<span className="text-zinc-400">{field.label}</span>
											<input
												className="h-10 rounded-md border border-zinc-700 bg-[#111216] px-3 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"
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
						<button
							className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-3 text-sm text-zinc-200 hover:bg-zinc-800"
							onClick={onClose}
							type="button"
						>
							Cancel
						</button>
						<button
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-600 bg-zinc-800 px-3 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
							disabled={isSaving}
							type="submit"
						>
							<Plus size={15} />
							Create project
						</button>
					</footer>
				</form>
			</section>
		</div>
	);
}
