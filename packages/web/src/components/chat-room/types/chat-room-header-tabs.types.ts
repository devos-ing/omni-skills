export type ChatRoomHeaderTabKey = "messages" | "taskDetails" | "action";

export interface ChatRoomHeaderTab {
	isActive: boolean;
	key: ChatRoomHeaderTabKey;
	label: string;
}

export interface BuildChatRoomHeaderTabsInput {
	activeTab: ChatRoomHeaderTabKey;
	hasTaskDetails: boolean;
}
