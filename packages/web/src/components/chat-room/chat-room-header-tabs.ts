import type {
	BuildChatRoomHeaderTabsInput,
	ChatRoomHeaderTab,
} from "./types/chat-room-header-tabs.types";

export function buildChatRoomHeaderTabs({
	activeTab,
	hasTaskDetails,
}: BuildChatRoomHeaderTabsInput): ChatRoomHeaderTab[] {
	const tabs: ChatRoomHeaderTab[] = [
		{ key: "messages", label: "Messages", isActive: activeTab === "messages" },
	];

	if (hasTaskDetails) {
		tabs.push({
			key: "taskDetails",
			label: "Task details",
			isActive: activeTab === "taskDetails",
		});
	}

	tabs.push({
		key: "action",
		label: "Action",
		isActive: activeTab === "action",
	});

	return tabs;
}
