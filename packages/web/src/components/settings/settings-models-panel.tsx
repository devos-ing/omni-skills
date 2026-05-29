"use client";

import { RefreshCw, RotateCcw, Save } from "lucide-react";
import { type ReactElement, type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { Typography } from "@/components/ui/typography";
import {
	useModelSettingsQuery,
	useUpdateModelSettingsMutation,
} from "@/lib/api/queries";
import type {
	SettingsModelStage,
	SettingsModelStageId,
	SettingsModelStageUpdate,
	SettingsReasoningEffort,
} from "@/lib/api/types/client.types";

type DraftByStage = Partial<
	Record<SettingsModelStageId, Omit<SettingsModelStageUpdate, "id">>
>;

export function SettingsModelsPanel(): ReactElement {
	const [drafts, setDrafts] = useState<DraftByStage>({});
	const query = useModelSettingsQuery({ refetchIntervalMs: false });
	const mutation = useUpdateModelSettingsMutation();
	const hasChanges = Object.keys(drafts).length > 0;

	const updateDraft = (
		stageId: SettingsModelStageId,
		patch: Omit<SettingsModelStageUpdate, "id">,
	): void => {
		setDrafts((current) => ({
			...current,
			[stageId]: { ...(current[stageId] ?? {}), ...patch },
		}));
	};

	const resetDraft = (stageId: SettingsModelStageId): void => {
		setDrafts((current) => {
			const next = { ...current };
			delete next[stageId];
			return next;
		});
	};

	const saveChanges = (): void => {
		const stages = Object.entries(drafts).map(([id, draft]) => ({
			id: id as SettingsModelStageId,
			...draft,
		}));
		mutation.mutate(
			{ stages },
			{
				onSuccess: () => {
					setDrafts({});
				},
			},
		);
	};

	if (query.isLoading) {
		return (
			<SettingsPanelShell>
				<Typography variant="description">Loading model settings...</Typography>
			</SettingsPanelShell>
		);
	}

	if (query.isError || !query.data) {
		return (
			<SettingsPanelShell>
				<Typography className="text-red-200" variant="description">
					Model settings are unavailable.
				</Typography>
			</SettingsPanelShell>
		);
	}

	return (
		<SettingsPanelShell>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<Typography variant="sectionTitle">Workflow Models</Typography>
					<Typography className="mt-1" variant="description">
						Set Codex model and reasoning defaults per workflow phase.
					</Typography>
				</div>
				<div className="flex gap-2">
					<Button
						disabled={mutation.isPending || !hasChanges}
						onClick={() => setDrafts({})}
						size="sm"
						type="button"
						variant="outline"
					>
						<RotateCcw size={15} />
						Reset
					</Button>
					<Button
						disabled={mutation.isPending || !hasChanges}
						onClick={saveChanges}
						size="sm"
						type="button"
					>
						<Save size={15} />
						Save
					</Button>
				</div>
			</div>
			<div className="grid gap-3">
				{query.data.stages.map((stage) => (
					<SettingsModelRow
						availableModels={query.data.availableModels.map(
							(model) => model.id,
						)}
						draft={drafts[stage.id]}
						key={stage.id}
						onReset={resetDraft}
						onUpdate={updateDraft}
						reasoningEfforts={query.data.reasoningEfforts}
						stage={stage}
					/>
				))}
			</div>
			{mutation.isError ? (
				<Typography className="text-red-200" variant="description">
					Could not save model settings.
				</Typography>
			) : null}
		</SettingsPanelShell>
	);
}

function SettingsPanelShell({
	children,
}: {
	children: ReactNode;
}): ReactElement {
	return (
		<section className="grid gap-4 rounded-lg border border-border bg-card p-4 text-zinc-100">
			{children}
		</section>
	);
}

function SettingsModelRow({
	availableModels,
	draft,
	onReset,
	onUpdate,
	reasoningEfforts,
	stage,
}: {
	availableModels: string[];
	draft: Omit<SettingsModelStageUpdate, "id"> | undefined;
	onReset: (stageId: SettingsModelStageId) => void;
	onUpdate: (
		stageId: SettingsModelStageId,
		patch: Omit<SettingsModelStageUpdate, "id">,
	) => void;
	reasoningEfforts: SettingsReasoningEffort[];
	stage: SettingsModelStage;
}): ReactElement {
	const modelValue = draft?.model ?? stage.model ?? "";
	const reasoningValue = draft?.reasoningEffort ?? stage.reasoningEffort ?? "";
	const modelListId = `settings-models-${stage.id}`;

	return (
		<div className="grid gap-3 rounded-md border border-border bg-surface-panel p-3 md:grid-cols-[minmax(8rem,0.75fr)_minmax(12rem,1fr)_minmax(10rem,0.75fr)_auto] md:items-end">
			<div className="min-w-0">
				<Typography className="truncate" variant="label">
					{stage.label}
				</Typography>
				<Typography className="mt-1 truncate" variant="muted">
					{stage.model ?? "Inherited model"}
				</Typography>
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor={`${stage.id}-model`}>Model</Label>
				<Input
					id={`${stage.id}-model`}
					list={modelListId}
					onChange={(event) =>
						onUpdate(stage.id, { model: event.target.value || null })
					}
					placeholder="Inherited default"
					value={modelValue}
				/>
				<datalist id={modelListId}>
					{availableModels.map((model) => (
						<option key={model} value={model} />
					))}
				</datalist>
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor={`${stage.id}-reasoning`}>Reasoning</Label>
				<NativeSelect
					id={`${stage.id}-reasoning`}
					onChange={(event) =>
						onUpdate(stage.id, {
							reasoningEffort: event.target.value
								? (event.target.value as SettingsReasoningEffort)
								: null,
						})
					}
					value={reasoningValue}
				>
					<NativeSelectOption value="">Inherited</NativeSelectOption>
					{reasoningEfforts.map((effort) => (
						<NativeSelectOption key={effort} value={effort}>
							{effort}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</div>
			<Button
				aria-label={`Reset ${stage.label} edits`}
				disabled={!draft}
				onClick={() => onReset(stage.id)}
				size="icon"
				type="button"
				variant="ghost"
			>
				<RefreshCw size={15} />
			</Button>
		</div>
	);
}
