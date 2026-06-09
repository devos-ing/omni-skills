import type {
	ChatRoomPanelLayout,
	ResolveChatRoomPanelLayoutInput,
} from "./types/chat-room-panel-layout.types";

const ROOT_CLASS_NAME =
	"relative grid h-[100dvh] min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden bg-background text-zinc-100";
const SESSION_BASE_CLASS_NAME = "grid min-h-0 min-w-0";

export function resolveChatRoomPanelLayout({
	activeContentMode,
	hasActiveTask,
}: ResolveChatRoomPanelLayoutInput): ChatRoomPanelLayout {
	const contentMode =
		activeContentMode === "taskDetails" && !hasActiveTask
			? "messages"
			: activeContentMode;
	const rowsClassName =
		contentMode === "messages"
			? "grid-rows-[auto_minmax(0,1fr)_auto]"
			: "grid-rows-[auto_minmax(0,1fr)]";

	return {
		contentMode,
		rootClassName: ROOT_CLASS_NAME,
		sessionClassName: `${SESSION_BASE_CLASS_NAME} ${rowsClassName}`,
	};
}
