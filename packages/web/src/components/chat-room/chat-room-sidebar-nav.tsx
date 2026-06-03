"use client";

import { ListChecks, Settings } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ChatRoomSidebarNavProps } from "./types/chat-room-sidebar.types";

export function ChatRoomSidebarNav({
	isCollapsed,
	onCloseSidebar,
	onSettingsClick,
}: ChatRoomSidebarNavProps): ReactElement {
	return (
		<nav className="grid gap-1 border-t border-border p-3">
			<Button
				asChild
				aria-label="Issues"
				className={cn(
					"h-9 w-full justify-start gap-2 px-2 text-xs text-zinc-400 hover:bg-surface-hover hover:text-zinc-200",
					isCollapsed && "md:justify-center md:px-0",
				)}
				size="sm"
				variant="ghost"
			>
				<Link href="/issues" onClick={onCloseSidebar}>
					<ListChecks size={15} />
					<Typography
						as="span"
						className={cn(
							"min-w-0 flex-1 truncate text-left",
							isCollapsed && "md:sr-only",
						)}
					>
						Issues
					</Typography>
				</Link>
			</Button>
			<Button
				aria-label="Settings"
				className={cn(
					"h-9 w-full justify-start gap-2 px-2 text-xs text-zinc-400 hover:bg-surface-hover hover:text-zinc-200",
					isCollapsed && "md:justify-center md:px-0",
				)}
				onClick={onSettingsClick}
				size="sm"
				type="button"
				variant="ghost"
			>
				<Settings size={15} />
				<Typography
					as="span"
					className={cn(
						"min-w-0 flex-1 truncate text-left",
						isCollapsed && "md:sr-only",
					)}
				>
					Settings
				</Typography>
			</Button>
		</nav>
	);
}
