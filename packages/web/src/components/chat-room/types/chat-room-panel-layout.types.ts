export type ChatRoomMainContentMode = "messages" | "taskDetails" | "action";

export interface ResolveChatRoomPanelLayoutInput {
	activeContentMode: ChatRoomMainContentMode;
	hasActiveTask: boolean;
}

export interface ChatRoomPanelLayout {
	contentMode: ChatRoomMainContentMode;
	rootClassName: string;
	sessionClassName: string;
}
