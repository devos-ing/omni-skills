"use client";

import { PanelLeft } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import type { ChatRoomHeaderProps } from "./types/chat-room.types";

export function ChatRoomHeader({
	projectId,
	sidebarControlId,
	title,
}: ChatRoomHeaderProps): ReactElement {
	return (
		<header className="flex items-center gap-3 border-b border-zinc-900 bg-[#111216] px-4 py-3">
			<Button
				asChild
				className="cursor-pointer md:hidden"
				size="icon"
				variant="ghost"
			>
				<label aria-label="Open chat sidebar" htmlFor={sidebarControlId}>
					<PanelLeft size={17} />
				</label>
			</Button>
			<div className="min-w-0">
				<h1 className="m-0 truncate text-base font-semibold">{title}</h1>
				<p className="m-0 mt-1 truncate text-xs text-zinc-500">{projectId}</p>
			</div>
		</header>
	);
}
