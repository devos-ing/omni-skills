"use client";

import EmojiPicker, {
	EmojiStyle,
	Theme,
	type EmojiClickData,
} from "emoji-picker-react";
import { Check, Plus, X } from "lucide-react";
import { type FormEvent, type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import type { GitHubRepositoryRecord } from "@/lib/api";

import { Field, RepositoryFields } from "./project-create-dialog-fields";
import type { ProjectFormState } from "./types/projects-panel.types";

interface ProjectCreateDialogProps {
	form: ProjectFormState;
	formError: string | null;
	isRepositoryLoading: boolean;
	isSaving: boolean;
	mode: "create" | "edit";
	repositories: GitHubRepositoryRecord[];
	repositoryUnavailableReason: string | null;
	onClose: () => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onUpdateField: (field: keyof ProjectFormState, value: string) => void;
}

export function ProjectCreateDialog({
	form,
	formError,
	isRepositoryLoading,
	isSaving,
	mode,
	repositories,
	repositoryUnavailableReason,
	onClose,
	onSubmit,
	onUpdateField,
}: ProjectCreateDialogProps): ReactElement {
	const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
	const hasRepositoryOptions = repositories.length > 0;
	const isEditMode = mode === "edit";
	const SubmitIcon = isEditMode ? Check : Plus;

	function selectEmoji(emoji: EmojiClickData): void {
		onUpdateField("emoji", emoji.emoji);
		setIsEmojiPickerOpen(false);
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="grid max-h-[min(48rem,calc(100dvh-2rem))] max-w-2xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden bg-surface-panel p-0"
				showCloseButton={false}
			>
				<DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-border px-4 py-3 text-left">
					<DialogTitle className="truncate text-base">
						{isEditMode ? "Edit project" : "New project"}
					</DialogTitle>
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
						<div className="grid gap-4 sm:grid-cols-[5rem_minmax(0,1fr)]">
							<div className="grid content-start gap-2">
								<Button
									aria-expanded={isEmojiPickerOpen}
									aria-label="Choose project emoji"
									className="h-16 w-16 text-3xl"
									onClick={() => setIsEmojiPickerOpen((open) => !open)}
									type="button"
									variant="secondary"
								>
									{form.emoji}
								</Button>
								<Typography className="text-zinc-500" variant="muted">
									Emoji
								</Typography>
							</div>
							<div className="grid gap-3">
								<Field htmlFor="project-create-name" label="Title">
									<Input
										autoFocus
										id="project-create-name"
										onChange={(event) =>
											onUpdateField("name", event.target.value)
										}
										placeholder="Project title"
										value={form.name}
									/>
								</Field>
								<Field htmlFor="project-create-description" label="Description">
									<textarea
										className="min-h-24 rounded-md border border-input bg-surface-input px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-muted-foreground/80 focus-visible:border-zinc-500 focus-visible:ring-2 focus-visible:ring-ring"
										id="project-create-description"
										onChange={(event) =>
											onUpdateField("description", event.target.value)
										}
										placeholder="What this project coordinates"
										value={form.description}
									/>
								</Field>
								<div className="grid gap-3 sm:grid-cols-2">
									<Field htmlFor="project-create-lead" label="Lead">
										<Input
											id="project-create-lead"
											onChange={(event) =>
												onUpdateField("lead", event.target.value)
											}
											placeholder="Owner or team"
											value={form.lead}
										/>
									</Field>
									<Field htmlFor="project-create-priority" label="Priority">
										<Input
											id="project-create-priority"
											inputMode="numeric"
											min={0}
											onChange={(event) =>
												onUpdateField("priority", event.target.value)
											}
											placeholder="0"
											step={1}
											type="number"
											value={form.priority}
										/>
									</Field>
								</div>
							</div>
						</div>
						{isEmojiPickerOpen ? (
							<div className="overflow-hidden rounded-md border border-border bg-surface-input">
								<EmojiPicker
									emojiStyle={EmojiStyle.NATIVE}
									height={320}
									onEmojiClick={selectEmoji}
									theme={Theme.DARK}
									width="100%"
								/>
							</div>
						) : null}
						<RepositoryFields
							form={form}
							hasRepositoryOptions={hasRepositoryOptions}
							isRepositoryLoading={isRepositoryLoading}
							repositories={repositories}
							repositoryUnavailableReason={repositoryUnavailableReason}
							onUpdateField={onUpdateField}
						/>
						{formError ? (
							<Typography
								className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2"
								variant="error"
							>
								{formError}
							</Typography>
						) : null}
					</div>
					<footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
						<Button
							onClick={onClose}
							size="sm"
							type="button"
							variant="secondary"
						>
							Cancel
						</Button>
						<Button disabled={isSaving} size="sm" type="submit">
							<SubmitIcon size={15} />
							{isEditMode ? "Save project" : "Create project"}
						</Button>
					</footer>
				</form>
			</DialogContent>
		</Dialog>
	);
}
