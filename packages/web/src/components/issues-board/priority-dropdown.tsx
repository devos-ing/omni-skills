"use client";

import type { ChangeEvent, ReactElement } from "react";

import { cn } from "@/lib/utils";

import { PRIORITY_OPTIONS } from "./issues-board.constants";
import type { IssuePriority } from "./issues-board.types";

interface PriorityDropdownProps {
	ariaLabel?: string;
	className?: string;
	value: number | string;
	onChange: (priority: IssuePriority) => void;
}

export function PriorityDropdown({
	ariaLabel = "Priority",
	className,
	value,
	onChange,
}: PriorityDropdownProps): ReactElement {
	function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
		onChange(Number(event.target.value) as IssuePriority);
	}

	return (
		<select
			aria-label={ariaLabel}
			className={cn("issue-input", className)}
			onChange={handleChange}
			value={String(value)}
		>
			{PRIORITY_OPTIONS.map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	);
}
