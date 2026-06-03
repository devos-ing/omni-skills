"use client";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import type { SidebarNavItem } from "@/components/web-shell/types/web-shell.types";
import { navItems } from "@/components/web-shell/web-shell.constants";
import { cn } from "@/lib/utils";
import {
	ArrowLeft,
	BookOpen,
	Bot,
	ChartColumn,
	Computer,
	GitBranch,
	Inbox,
	ListChecks,
	MessageSquare,
	Plug,
	Settings,
	SlidersHorizontal,
	Sparkles,
	SquareKanban,
	UsersRound,
	X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactElement } from "react";
import type { ChatRoomSettingsSidebarProps } from "./types/chat-room.types";

const iconByKey: Record<
	SidebarNavItem["key"],
	ComponentType<{ size?: number }>
> = {
	agents: Bot,
	git: Bot,
	autopilot: Sparkles,
	chat: MessageSquare,
	inbox: Inbox,
	issues: ListChecks,
	integrations: Plug,
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
	const pathname = usePathname();

	return (
		<div
			aria-hidden={!isActive}
			className={cn(
				"absolute inset-0 grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden transition-[opacity,transform] duration-200 ease-out",
				isActive
					? "translate-x-0 opacity-100"
					: "pointer-events-none -translate-x-full opacity-0",
			)}
			inert={!isActive ? true : undefined}
		>
			<header className="border-b border-border p-3">
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
				<Typography className="mb-2 px-2" variant="eyebrow">
					Settings
				</Typography>
				<Typography className="mb-2 mt-4 px-2" variant="eyebrow">
					Workspace
				</Typography>
				<div className="grid gap-1">
					{navItems.map((item) => {
						const Icon = iconByKey[item.key];
						const isActiveItem =
							pathname === item.href ||
							pathname.startsWith(`${item.href}/`) ||
							(item.key === "chat" && pathname.startsWith("/session/"));
						return (
							<Link
								aria-current={isActiveItem ? "page" : undefined}
								className={cn(
									"flex h-9 items-center gap-2 rounded-md px-2 text-xs",
									isActiveItem
										? "bg-surface-active text-zinc-100"
										: "text-muted-foreground hover:bg-surface-hover hover:text-zinc-200",
								)}
								href={item.href}
								key={item.key}
								onClick={onNavigate}
							>
								<Icon size={15} />
								<Typography as="span" className="truncate" variant="muted">
									{item.label}
								</Typography>
							</Link>
						);
					})}
				</div>
			</nav>
		</div>
	);
}
