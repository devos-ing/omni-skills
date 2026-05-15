"use client";

import { Save, X } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";

import type { AgentRecord } from "@/lib/api";
import { useUpdateAgentMutation } from "@/lib/api/queries";

import {
	type AgentDraft,
	createAgentDraft,
	parseLineList,
} from "./agents-panel.types";

interface AgentDetailDialogProps {
	agent: AgentRecord;
	onClose: () => void;
}

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
		<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
			<dialog
				aria-labelledby="agent-detail-dialog-title"
				aria-modal="true"
				className="grid max-h-[92vh] w-full max-w-3xl gap-4 overflow-auto rounded-lg border border-zinc-800 bg-[#18191d] p-5 text-zinc-100 shadow-2xl"
				open
			>
				<header className="flex items-start justify-between gap-4">
					<div>
						<p className="mb-1 text-xs font-medium uppercase text-zinc-500">
							Agent Detail
						</p>
						<h2
							className="m-0 text-lg font-semibold"
							id="agent-detail-dialog-title"
						>
							{agent.id}
						</h2>
					</div>
					<button
						aria-label="Close dialog"
						className="grid h-9 w-9 place-items-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
						onClick={onClose}
						type="button"
					>
						<X size={17} />
					</button>
				</header>
				<div className="grid gap-3 sm:grid-cols-2">
					<Field label="Title">
						<input
							className="issue-input"
							value={draft.name}
							onChange={(event) =>
								setDraft({ ...draft, name: event.target.value })
							}
						/>
					</Field>
					<Field label="Owner">
						<input
							className="issue-input"
							value={draft.owner}
							onChange={(event) =>
								setDraft({ ...draft, owner: event.target.value })
							}
						/>
					</Field>
					<Field label="Runtime">
						<input
							className="issue-input"
							value={draft.runtime}
							onChange={(event) =>
								setDraft({ ...draft, runtime: event.target.value })
							}
						/>
					</Field>
					<Field label="Backend">
						<input
							className="issue-input"
							value={draft.backend}
							onChange={(event) =>
								setDraft({ ...draft, backend: event.target.value })
							}
						/>
					</Field>
					<Field label="Model">
						<input
							className="issue-input"
							value={draft.model}
							onChange={(event) =>
								setDraft({ ...draft, model: event.target.value })
							}
						/>
					</Field>
					<Field label="Concurrency">
						<input
							className="issue-input"
							type="number"
							min={1}
							value={draft.concurrency}
							onChange={(event) =>
								setDraft({ ...draft, concurrency: event.target.value })
							}
						/>
					</Field>
					<Field label="Created at">
						<input
							className="issue-input"
							value={draft.createdAt}
							onChange={(event) =>
								setDraft({ ...draft, createdAt: event.target.value })
							}
						/>
					</Field>
					<Field label="Updated at">
						<input
							className="issue-input"
							value={draft.updatedAt}
							onChange={(event) =>
								setDraft({ ...draft, updatedAt: event.target.value })
							}
						/>
					</Field>
					<Field label="Logo">
						<input
							className="issue-input"
							value={draft.logo}
							onChange={(event) =>
								setDraft({ ...draft, logo: event.target.value })
							}
						/>
					</Field>
				</div>
				<Field label="Description">
					<textarea
						className="issue-input min-h-24 resize-y"
						value={draft.description}
						onChange={(event) =>
							setDraft({ ...draft, description: event.target.value })
						}
					/>
				</Field>
				<div className="grid gap-3 sm:grid-cols-3">
					<Field label="Skills">
						<textarea
							className="issue-input min-h-24 resize-y"
							value={draft.skills}
							onChange={(event) =>
								setDraft({ ...draft, skills: event.target.value })
							}
						/>
					</Field>
					<Field label="Recent work">
						<textarea
							className="issue-input min-h-24 resize-y"
							value={draft.recentWork}
							onChange={(event) =>
								setDraft({ ...draft, recentWork: event.target.value })
							}
						/>
					</Field>
					<Field label="Activity">
						<textarea
							className="issue-input min-h-24 resize-y"
							value={draft.activity}
							onChange={(event) =>
								setDraft({ ...draft, activity: event.target.value })
							}
						/>
					</Field>
				</div>
				<Field label="Instructions">
					<textarea
						className="issue-input min-h-28 resize-y"
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
					<button
						className="issue-secondary-button"
						onClick={onClose}
						type="button"
					>
						Cancel
					</button>
					<button
						className="issue-primary-button"
						disabled={updateAgent.isPending}
						onClick={handleSave}
						type="button"
					>
						<Save size={15} />
						{updateAgent.isPending ? "Saving..." : "Save"}
					</button>
				</footer>
			</dialog>
		</div>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: ReactElement;
}): ReactElement {
	return (
		<div className="grid gap-1.5 text-sm text-zinc-400">
			<span>{label}</span>
			{children}
		</div>
	);
}
