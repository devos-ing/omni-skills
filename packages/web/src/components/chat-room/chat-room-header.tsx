"use client";

import {
	Activity,
	FileText,
	Loader2,
	MessageCircle,
	PanelLeft,
	RotateCcw,
} from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { buildChatRoomHeaderTabs } from "./chat-room-header-tabs";
import type { ChatRoomHeaderTabKey } from "./types/chat-room-header-tabs.types";
import type { ChatRoomHeaderProps } from "./types/chat-room.types";

export function ChatRoomHeader({
	activeTaskId,
	activeTab,
	isRerunDisabled,
	isRerunning,
	isRerunVisible,
	title,
	onOpenAction,
	onOpenMessages,
	onOpenSidebar,
	onOpenTaskDetails,
	onRerunWorkflow,
}: ChatRoomHeaderProps): ReactElement {
	const tabs = buildChatRoomHeaderTabs({
		activeTab,
		hasTaskDetails: Boolean(activeTaskId),
	});

	function selectTab(key: ChatRoomHeaderTabKey): void {
		if (key === "taskDetails") {
			onOpenTaskDetails();
			return;
		}
		if (key === "action") {
			onOpenAction();
			return;
		}
		onOpenMessages();
	}

	return (
		<header className="grid border-b border-border">
			<div className="flex items-center justify-between gap-3 px-4 py-2">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					<Button
						aria-label="Open chat sidebar"
						className="md:hidden"
						onClick={onOpenSidebar}
						size="icon"
						type="button"
						variant="ghost"
					>
						<PanelLeft size={17} />
					</Button>
					<div className="min-w-0">
						<Typography className="truncate text-zinc-300">{title}</Typography>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{isRerunVisible ? (
						<Button
							aria-label="Rerun failed workflow"
							disabled={isRerunDisabled}
							onClick={onRerunWorkflow}
							size="icon"
							title="Rerun workflow"
							type="button"
							variant="outline"
						>
							{isRerunning ? (
								<Loader2
									aria-hidden="true"
									className="animate-spin"
									size={16}
								/>
							) : (
								<RotateCcw aria-hidden="true" size={16} />
							)}
						</Button>
					) : null}
				</div>
			</div>
			<nav aria-label="Session tabs" className="flex min-w-0 gap-1 px-4">
				{tabs.map((tab) => {
					const Icon =
						tab.key === "taskDetails"
							? FileText
							: tab.key === "action"
								? Activity
								: MessageCircle;
					return (
						<button
							aria-current={tab.isActive ? "page" : undefined}
							className={cn(
								"flex h-9 min-w-0 items-center gap-2 border-b-2 px-2 text-sm text-zinc-400 hover:text-zinc-100",
								tab.isActive
									? "border-zinc-200 text-zinc-100"
									: "border-transparent hover:border-zinc-600",
							)}
							key={tab.key}
							onClick={() => selectTab(tab.key)}
							type="button"
						>
							<Icon aria-hidden="true" size={15} />
							<span className="truncate">{tab.label}</span>
						</button>
					);
				})}
			</nav>
		</header>
	);
}
