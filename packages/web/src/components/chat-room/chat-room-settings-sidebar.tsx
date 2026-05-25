"use client";

import type { SidebarNavItem } from "@/components/web-shell/types/web-shell.types";
import { navItems } from "@/components/web-shell/web-shell.constants";
import {
	ArrowLeft,
	BookOpen,
	Bot,
	ChartColumn,
	Computer,
	Inbox,
	ListChecks,
	MessageSquare,
	Settings,
	Sparkles,
	SquareKanban,
	UsersRound,
	X,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatRoomSettingsSidebarProps } from "./types/chat-room.types";

const iconByKey: Record<
	SidebarNavItem["key"],
	ComponentType<{ size?: number }>
> = {
	agents: Bot,
	autopilot: Sparkles,
	chat: MessageSquare,
	inbox: Inbox,
	issues: ListChecks,
	projects: SquareKanban,
	runtimes: Computer,
	settings: Settings,
	skills: BookOpen,
	squads: UsersRound,
	usage: ChartColumn,
};

export function ChatRoomSettingsSidebar({
	isActive,
	onBack,
	onClose,
	onNavigate,
}: ChatRoomSettingsSidebarProps): ReactElement {
	return (
		<div
			aria-hidden={!isActive}
			className={cn(
				"absolute inset-0 grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] transition-transform duration-200 ease-out",
				isActive ? "translate-x-0" : "pointer-events-none -translate-x-full",
			)}
			inert={!isActive ? true : undefined}
		>
			<header className="border-b border-zinc-900 p-3">
				<div className="flex min-w-0 gap-2">
					<Button
						className="min-w-0 flex-1 justify-start"
						onClick={onBack}
						size="sm"
						type="button"
						variant="outline"
					>
						<ArrowLeft size={16} />
						Back
					</Button>
					<Button
						aria-label="Close chat sidebar"
						className="md:hidden"
						onClick={onClose}
						size="icon"
						type="button"
						variant="ghost"
					>
						<X size={16} />
					</Button>
				</div>
			</header>
			<nav className="min-h-0 overflow-auto p-3">
				<div className="mb-2 px-2 text-xs font-medium uppercase text-zinc-500">
					Workspace
				</div>
				<div className="grid gap-1">
					{navItems.map((item) => {
						const Icon = iconByKey[item.key];
						const isActiveItem = item.key === "chat";
						return (
							<Link
								aria-current={isActiveItem ? "page" : undefined}
								className={cn(
									"flex h-9 items-center gap-2 rounded-md px-2 text-xs",
									isActiveItem
										? "bg-zinc-800 text-zinc-100"
										: "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200",
								)}
								href={item.href}
								key={item.key}
								onClick={onNavigate}
							>
								<Icon size={15} />
								<span className="truncate">{item.label}</span>
							</Link>
						);
					})}
				</div>
			</nav>
		</div>
	);
}
