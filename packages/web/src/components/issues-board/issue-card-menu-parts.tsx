import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";

export function MenuField({
	children,
	label,
}: {
	children: ReactElement;
	label: string;
}): ReactElement {
	return (
		<div className="grid gap-1 text-xs text-zinc-500">
			<span>{label}</span>
			{children}
		</div>
	);
}

export function MenuButton({
	danger = false,
	icon,
	label,
	onClick,
}: {
	danger?: boolean;
	icon: ReactElement;
	label: string;
	onClick: () => void;
}): ReactElement {
	return (
		<Button
			className={`h-8 justify-start gap-2 px-2 text-sm ${
				danger
					? "text-red-300 hover:bg-red-950/40"
					: "text-zinc-300 hover:bg-zinc-800"
			}`}
			onClick={onClick}
			size="sm"
			type="button"
			variant="ghost"
		>
			{icon}
			<span>{label}</span>
		</Button>
	);
}
