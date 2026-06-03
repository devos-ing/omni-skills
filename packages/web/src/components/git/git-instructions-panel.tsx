"use client";

import { RotateCcw, Save } from "lucide-react";
import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Typography } from "@/components/ui/typography";
import {
	useGitHubSettingsQuery,
	useUpdateGitHubSettingsMutation,
} from "@/lib/api/queries";
import type { SettingsGithubUpdateRequest } from "@/lib/api/types/client.types";

export function GitInstructionsPanel(): ReactElement {
	const [draft, setDraft] = useState<Partial<SettingsGithubUpdateRequest>>({});
	const query = useGitHubSettingsQuery({ refetchIntervalMs: false });
	const mutation = useUpdateGitHubSettingsMutation();
	const commitInstruction =
		draft.commitInstruction ?? query.data?.commitInstruction ?? "";
	const prInstruction = draft.prInstruction ?? query.data?.prInstruction ?? "";
	const hasChanges = Object.keys(draft).length > 0;

	const resetChanges = (): void => {
		setDraft({});
	};

	const saveChanges = (): void => {
		mutation.mutate(
			{ commitInstruction, prInstruction },
			{
				onSuccess: () => setDraft({}),
			},
		);
	};

	if (query.isLoading) {
		return (
			<section className="grid gap-4 text-zinc-100">
				<Typography variant="description">
					Loading Git instructions...
				</Typography>
			</section>
		);
	}

	if (query.isError || !query.data) {
		return (
			<section className="grid gap-4 text-zinc-100">
				<Typography className="text-red-200" variant="description">
					Git instructions are unavailable.
				</Typography>
			</section>
		);
	}

	return (
		<section className="grid gap-4 text-zinc-100">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<Typography variant="sectionTitle">Git Instructions</Typography>
				<div className="flex gap-2">
					<Button
						disabled={mutation.isPending || !hasChanges}
						onClick={resetChanges}
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
			<div className="grid gap-3 rounded-md border border-border bg-surface-panel p-3">
				<div className="grid gap-1.5">
					<Label htmlFor="git-commit-instruction">Commit</Label>
					<Textarea
						id="git-commit-instruction"
						onChange={(event) =>
							setDraft((current) => ({
								...current,
								commitInstruction: event.target.value,
							}))
						}
						rows={3}
						value={commitInstruction}
					/>
				</div>
				<div className="grid gap-1.5">
					<Label htmlFor="git-pr-instruction">Pull request</Label>
					<Textarea
						id="git-pr-instruction"
						onChange={(event) =>
							setDraft((current) => ({
								...current,
								prInstruction: event.target.value,
							}))
						}
						rows={7}
						value={prInstruction}
					/>
				</div>
			</div>
			{mutation.isError ? (
				<Typography className="text-red-200" variant="description">
					Could not save Git instructions.
				</Typography>
			) : null}
		</section>
	);
}
