"use client";

import type { ReactElement } from "react";

import { ChatRoomPanel } from "@/components/chat-room/chat-room-panel";
import { useOperatorIssueActions } from "@/components/web-shell/operator-issue-actions-context";

export default function ChatPage(): ReactElement {
	const { commandDraftRequest, createSessionRequest, requestSearch } =
		useOperatorIssueActions();

	return (
		<ChatRoomPanel
			commandDraftRequest={commandDraftRequest}
			newSessionRequest={createSessionRequest}
			onSearchRequest={requestSearch}
		/>
	);
}
