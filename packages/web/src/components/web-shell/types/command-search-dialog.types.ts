import type { CommandHistoryRecord, ProjectBoardTaskRecord } from "@/lib/api";

import type { SidebarNavItem } from "./web-shell.types";

export type CommandSearchResult =
	| {
			id: string;
			kind: "chatCommand";
			label: string;
			detail: string;
			command: string;
			hint: string;
	  }
	| {
			id: string;
			kind: "navigation";
			label: string;
			detail: string;
			navKey: SidebarNavItem["key"];
	  }
	| {
			id: string;
			kind: "action";
			label: string;
			detail: string;
			action: "newIssue";
	  }
	| {
			id: string;
			kind: "issue";
			label: string;
			detail: string;
			task: ProjectBoardTaskRecord;
	  }
	| {
			id: string;
			kind: "history";
			label: string;
			detail: string;
			command: string;
	  };

export interface CommandSearchGroup {
	id: string;
	label: string;
	results: CommandSearchResult[];
}

export interface CommandSearchDialogProps {
	activeKey: SidebarNavItem["key"];
	boardError: Error | null;
	commandHistory: CommandHistoryRecord[] | undefined;
	commandHistoryError: Error | null;
	isBoardLoading: boolean;
	isCommandHistoryLoading: boolean;
	isOpen: boolean;
	navItems: SidebarNavItem[];
	onClose: () => void;
	onNavigate: (key: SidebarNavItem["key"]) => void;
	onNewIssue: () => void;
	onOpenIssue: (taskId: string) => void;
	onSelectCommand: (draft: string) => void;
	tasks: ProjectBoardTaskRecord[] | undefined;
}
