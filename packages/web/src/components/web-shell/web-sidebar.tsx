"use client";

import {
	BookOpen,
	Bot,
	ChartColumn,
	CircleHelp,
	Computer,
	Inbox,
	ListChecks,
	MessageSquare,
	PanelLeft,
	PencilLine,
	Search,
	Settings,
	Sparkles,
	SquareKanban,
	UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import type {
	SidebarDisplayMode,
	SidebarNavItem,
} from "@/components/web-shell/types/web-shell.types";
import { cn } from "@/lib/utils";
import { SidebarPinnedIssues } from "./web-sidebar-pins";

interface WebSidebarProps {
	mode: SidebarDisplayMode;
	activeKey: SidebarNavItem["key"];
	navItems: SidebarNavItem[];
	onNewSession: () => void;
	onSearch: () => void;
	onToggleMode: () => void;
}

const iconByKey: Record<
	SidebarNavItem["key"],
	ComponentType<{ size?: number }>
> = {
	agents: Bot,
	runtimes: Computer,
	skills: BookOpen,
	chat: MessageSquare,
	settings: Settings,
	issues: ListChecks,
	projects: SquareKanban,
	inbox: Inbox,
	autopilot: Sparkles,
	squads: UsersRound,
	usage: ChartColumn,
};

function nextSidebarLabel(mode: SidebarDisplayMode): string {
	if (mode === "expanded") {
		return "Collapse sidebar";
	}
	if (mode === "collapsed") {
		return "Expand sidebar";
	}
	return "Show sidebar";
}

export function WebSidebar({
	mode,
	activeKey,
	navItems,
	onNewSession,
	onSearch,
	onToggleMode,
}: WebSidebarProps): ReactElement {
	const isExpanded = mode === "expanded";
	const isHidden = mode === "hidden";
	return (
		<aside
			aria-label="Primary navigation"
			className="grid h-[100dvh] max-h-[100dvh] border-r border-border bg-surface-panel text-zinc-400"
			style={{
				width: isHidden ? "0" : isExpanded ? "14rem" : "6.5rem",
				opacity: isHidden ? 0 : 1,
				pointerEvents: isHidden ? "none" : "auto",
				transition: "width 180ms ease, opacity 120ms ease",
				overflow: "hidden",
				gridTemplateRows: "auto auto 1fr auto",
			}}
		>
			<header
				className={cn(
					"flex items-center gap-3 p-4",
					!isExpanded && "grid justify-items-center gap-2 px-3",
				)}
			>
				<Typography
					as="strong"
					className={cn(
						"min-w-0 flex-1 truncate text-zinc-100",
						!isExpanded && "w-full text-center text-xs",
					)}
					variant="cardTitle"
				>
					DEVOS.ING
				</Typography>
				<Button
					aria-label={nextSidebarLabel(mode)}
					className={cn(isExpanded && "ml-auto")}
					onClick={onToggleMode}
					size="icon"
					title={nextSidebarLabel(mode)}
					type="button"
					variant="ghost"
				>
					<PanelLeft size={16} />
				</Button>
			</header>
			<div className="grid gap-2 px-3 pb-4">
				<SidebarAction
					icon={Search}
					isExpanded={isExpanded}
					label="Search..."
					onClick={onSearch}
				/>
				<SidebarAction
					icon={PencilLine}
					isExpanded={isExpanded}
					label="New Session"
					onClick={onNewSession}
				/>
				<SidebarPinnedIssues isExpanded={isExpanded} />
			</div>
			<nav className="grid content-start gap-6 px-3">
				<NavGroup
					activeKey={activeKey}
					isExpanded={isExpanded}
					items={navItems.slice(0, 7)}
					title="Workspace"
				/>
				<NavGroup
					activeKey={activeKey}
					isExpanded={isExpanded}
					items={navItems.slice(7)}
					title="Configure"
				/>
			</nav>
			<footer className="flex items-center justify-between p-4">
				{isExpanded ? <Typography variant="muted">devos.ing</Typography> : null}
				<CircleHelp size={16} />
			</footer>
		</aside>
	);
}

function NavGroup({
	title,
	items,
	activeKey,
	isExpanded,
}: {
	title: string;
	items: SidebarNavItem[];
	activeKey: SidebarNavItem["key"];
	isExpanded: boolean;
}): ReactElement {
	return (
		<div className="grid gap-1">
			{isExpanded ? (
				<Typography className="mb-1 px-2 text-[0.6875rem]" variant="muted">
					{title}
				</Typography>
			) : null}
			{items.map((item) => {
				const Icon = iconByKey[item.key];
				const isActive = item.key === activeKey;
				return (
					<Link
						aria-current={isActive ? "page" : undefined}
						className={cn(
							"flex h-10 items-center gap-3 rounded-md px-2 text-xs font-normal",
							isActive
								? "bg-surface-active text-zinc-100"
								: "text-muted-foreground hover:bg-surface-hover hover:text-zinc-200",
							!isExpanded && "justify-center",
						)}
						href={item.href}
						key={item.key}
						title={item.label}
					>
						<Icon size={18} />
						{isExpanded ? (
							<Typography as="span" variant="muted">
								{item.label}
							</Typography>
						) : null}
					</Link>
				);
			})}
		</div>
	);
}

function SidebarAction({
	icon: Icon,
	isExpanded,
	label,
	onClick,
}: {
	icon: ComponentType<{ size?: number }>;
	isExpanded: boolean;
	label: string;
	onClick?: () => void;
}): ReactElement {
	return (
		<Button
			className={cn(
				"h-9 justify-start gap-3 px-2 text-xs font-normal text-muted-foreground hover:bg-surface-hover hover:text-zinc-200",
				!isExpanded && "justify-center",
			)}
			onClick={onClick}
			size="sm"
			type="button"
			variant="ghost"
		>
			<Icon size={18} />
			{isExpanded ? (
				<Typography as="span" variant="muted">
					{label}
				</Typography>
			) : null}
		</Button>
	);
}
