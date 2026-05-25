import type { ReactElement } from "react";

export function AgentDetailField({
	children,
	label,
}: {
	children: ReactElement;
	label: string;
}): ReactElement {
	return (
		<div className="grid gap-1.5 text-sm text-zinc-400">
			<span>{label}</span>
			{children}
		</div>
	);
}
