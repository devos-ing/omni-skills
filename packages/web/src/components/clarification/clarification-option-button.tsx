"use client";

import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import type { TaskClarificationOption } from "@/lib/api";

interface ClarificationOptionButtonProps {
	disabled?: boolean;
	option: TaskClarificationOption;
	selected: boolean;
	onSelect: () => void;
}

export function ClarificationOptionButton({
	disabled,
	option,
	selected,
	onSelect,
}: ClarificationOptionButtonProps): ReactElement {
	return (
		<Button
			disabled={disabled}
			onClick={onSelect}
			size="sm"
			type="button"
			variant={selected ? "default" : "secondary"}
		>
			<Typography as="span">{option.label}</Typography>
			{option.recommended ? (
				<Typography
					className="rounded-sm border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-200"
					variant="eyebrow"
				>
					Recommended
				</Typography>
			) : null}
		</Button>
	);
}
