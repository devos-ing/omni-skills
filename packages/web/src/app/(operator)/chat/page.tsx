"use client";

import type { ReactElement } from "react";

import { ChatRoomPanel } from "@/components/chat-room/chat-room-panel";
import { useOperatorIssueActions } from "@/components/web-shell/operator-issue-actions-context";

export default function ChatPage(): ReactElement {
	const { createSessionRequest, requestSearch } = useOperatorIssueActions();

	return (
		<ChatRoomPanel
			newSessionRequest={createSessionRequest}
			onSearchRequest={requestSearch}
		/>
	);
}
