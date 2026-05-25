"use client";

import type { ChangeEvent, ReactElement } from "react";

import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import { PRIORITY_OPTIONS } from "./issues-board.constants";
import type { IssuePriority } from "./types/issues-board.types";

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
		<NativeSelect
			aria-label={ariaLabel}
			className={cn(className)}
			onChange={handleChange}
			value={String(value)}
		>
			{PRIORITY_OPTIONS.map((option) => (
				<NativeSelectOption key={option.value} value={option.value}>
					{option.label}
				</NativeSelectOption>
			))}
		</NativeSelect>
	);
}
