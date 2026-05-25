"use client";

import { Save, X } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AgentRecord } from "@/lib/api";
import { useUpdateAgentMutation } from "@/lib/api/queries";

import { AgentDetailField as Field } from "./agent-detail-field";
import {
	type AgentDraft,
	createAgentDraft,
	parseLineList,
} from "./types/agents-panel.types";

type AgentDetailDialogProps = { agent: AgentRecord; onClose: () => void };

export function AgentDetailDialog({
	agent,
	onClose,
}: AgentDetailDialogProps): ReactElement {
	const [draft, setDraft] = useState<AgentDraft>(() => createAgentDraft(agent));
	const [localError, setLocalError] = useState<string | null>(null);
	const updateAgent = useUpdateAgentMutation();

	useEffect(() => {
		setDraft(createAgentDraft(agent));
		setLocalError(null);
	}, [agent]);

	async function handleSave(): Promise<void> {
		setLocalError(null);
		const concurrency = Number(draft.concurrency);
		if (!Number.isInteger(concurrency) || concurrency < 1) {
			setLocalError("Concurrency must be a positive integer.");
			return;
		}
		if (!draft.name.trim() || !draft.runtime.trim() || !draft.model.trim()) {
			setLocalError("Title, runtime, and model are required.");
			return;
		}
		try {
			await updateAgent.mutateAsync({
				agentId: agent.id,
				agent: {
					name: draft.name.trim(),
					description: draft.description.trim(),
					logo: draft.logo.trim(),
					runtime: draft.runtime.trim(),
					backend: draft.backend.trim(),
					model: draft.model.trim(),
					concurrency,
					owner: draft.owner.trim(),
					createdAt: draft.createdAt.trim(),
					updatedAt: draft.updatedAt.trim(),
					skills: parseLineList(draft.skills),
					recentWork: parseLineList(draft.recentWork),
					activity: parseLineList(draft.activity),
					instructions: draft.instructions.trim(),
				},
			});
		} catch (error) {
			setLocalError(
				error instanceof Error ? error.message : "Failed to update agent",
			);
		}
	}

	const errorMessage = localError ?? updateAgent.error?.message ?? null;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="max-h-[92vh] max-w-3xl overflow-auto p-5"
				showCloseButton={false}
			>
				<DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 text-left">
					<div>
						<p className="mb-1 text-xs font-medium uppercase text-zinc-500">
							Agent Detail
						</p>
						<DialogTitle>{agent.id}</DialogTitle>
					</div>
					<Button
						aria-label="Close dialog"
						onClick={onClose}
						size="iconLg"
						type="button"
						variant="secondary"
					>
						<X size={17} />
					</Button>
				</DialogHeader>
				<div className="grid gap-3 sm:grid-cols-2">
					<Field label="Title">
						<Input
							value={draft.name}
							onChange={(event) =>
								setDraft({ ...draft, name: event.target.value })
							}
						/>
					</Field>
					<Field label="Owner">
						<Input
							value={draft.owner}
							onChange={(event) =>
								setDraft({ ...draft, owner: event.target.value })
							}
						/>
					</Field>
					<Field label="Runtime">
						<Input
							value={draft.runtime}
							onChange={(event) =>
								setDraft({ ...draft, runtime: event.target.value })
							}
						/>
					</Field>
					<Field label="Backend">
						<Input
							value={draft.backend}
							onChange={(event) =>
								setDraft({ ...draft, backend: event.target.value })
							}
						/>
					</Field>
					<Field label="Model">
						<Input
							value={draft.model}
							onChange={(event) =>
								setDraft({ ...draft, model: event.target.value })
							}
						/>
					</Field>
					<Field label="Concurrency">
						<Input
							type="number"
							min={1}
							value={draft.concurrency}
							onChange={(event) =>
								setDraft({ ...draft, concurrency: event.target.value })
							}
						/>
					</Field>
					<Field label="Created at">
						<Input
							value={draft.createdAt}
							onChange={(event) =>
								setDraft({ ...draft, createdAt: event.target.value })
							}
						/>
					</Field>
					<Field label="Updated at">
						<Input
							value={draft.updatedAt}
							onChange={(event) =>
								setDraft({ ...draft, updatedAt: event.target.value })
							}
						/>
					</Field>
					<Field label="Logo">
						<Input
							value={draft.logo}
							onChange={(event) =>
								setDraft({ ...draft, logo: event.target.value })
							}
						/>
					</Field>
				</div>
				<Field label="Description">
					<Textarea
						className="min-h-24 resize-y"
						value={draft.description}
						onChange={(event) =>
							setDraft({ ...draft, description: event.target.value })
						}
					/>
				</Field>
				<div className="grid gap-3 sm:grid-cols-3">
					<Field label="Skills">
						<Textarea
							className="min-h-24 resize-y"
							value={draft.skills}
							onChange={(event) =>
								setDraft({ ...draft, skills: event.target.value })
							}
						/>
					</Field>
					<Field label="Recent work">
						<Textarea
							className="min-h-24 resize-y"
							value={draft.recentWork}
							onChange={(event) =>
								setDraft({ ...draft, recentWork: event.target.value })
							}
						/>
					</Field>
					<Field label="Activity">
						<Textarea
							className="min-h-24 resize-y"
							value={draft.activity}
							onChange={(event) =>
								setDraft({ ...draft, activity: event.target.value })
							}
						/>
					</Field>
				</div>
				<Field label="Instructions">
					<Textarea
						className="min-h-28 resize-y"
						value={draft.instructions}
						onChange={(event) =>
							setDraft({ ...draft, instructions: event.target.value })
						}
					/>
				</Field>
				{errorMessage ? (
					<p className="m-0 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
						{errorMessage}
					</p>
				) : null}
				<footer className="flex justify-end gap-2">
					<Button onClick={onClose} type="button" variant="secondary">
						Cancel
					</Button>
					<Button
						disabled={updateAgent.isPending}
						onClick={handleSave}
						type="button"
					>
						<Save size={15} />
						{updateAgent.isPending ? "Saving..." : "Save"}
					</Button>
				</footer>
			</DialogContent>
		</Dialog>
	);
}
