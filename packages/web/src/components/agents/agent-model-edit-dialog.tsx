"use client";

import { Save, X } from "lucide-react";
import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { Typography } from "@/components/ui/typography";
import type { AgentRecord, SettingsReasoningEffort } from "@/lib/api";
import { useUpdateAgentMutation } from "@/lib/api/queries";

import type { AgentModelEditOptions } from "./types/agent-list.types";

interface AgentModelEditDialogProps {
	agent: AgentRecord;
	options: AgentModelEditOptions;
	onClose: () => void;
}

export function AgentModelEditDialog({
	agent,
	options,
	onClose,
}: AgentModelEditDialogProps): ReactElement {
	const [model, setModel] = useState(agent.model);
	const [reasoningEffort, setReasoningEffort] = useState(
		agent.reasoningEffort ?? "",
	);
	const [localError, setLocalError] = useState<string | null>(null);
	const updateAgent = useUpdateAgentMutation();
	const modelListId = `agent-model-options-${agent.id}`;

	async function handleSave(): Promise<void> {
		const trimmedModel = model.trim();
		setLocalError(null);
		if (!trimmedModel) {
			setLocalError("Model is required.");
			return;
		}

		try {
			await updateAgent.mutateAsync({
				agentId: agent.id,
				agent: {
					model: trimmedModel,
					reasoningEffort: reasoningEffort
						? (reasoningEffort as SettingsReasoningEffort)
						: null,
				},
			});
			onClose();
		} catch (error) {
			setLocalError(
				error instanceof Error ? error.message : "Failed to update agent",
			);
		}
	}

	const errorMessage = localError ?? updateAgent.error?.message ?? null;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-md p-5" showCloseButton={false}>
				<DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 text-left">
					<div className="min-w-0">
						<Typography className="mb-1" variant="eyebrow">
							Agent Model
						</Typography>
						<DialogTitle className="truncate">{agent.name}</DialogTitle>
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
				<div className="grid gap-4">
					<div className="grid gap-1.5">
						<Label htmlFor="agent-model">Model</Label>
						<Input
							id="agent-model"
							list={modelListId}
							onChange={(event) => setModel(event.target.value)}
							value={model}
						/>
						<datalist id={modelListId}>
							{options.models.map((option) => (
								<option key={option} value={option} />
							))}
						</datalist>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="agent-reasoning">Reasoning</Label>
						<NativeSelect
							id="agent-reasoning"
							onChange={(event) => setReasoningEffort(event.target.value)}
							value={reasoningEffort}
						>
							<NativeSelectOption value="">Default</NativeSelectOption>
							{options.reasoningEfforts.map((effort) => (
								<NativeSelectOption key={effort} value={effort}>
									{effort}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</div>
				</div>
				{errorMessage ? (
					<Typography
						className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2"
						variant="error"
					>
						{errorMessage}
					</Typography>
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
