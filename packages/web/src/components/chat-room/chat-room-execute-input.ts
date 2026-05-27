import type { ChatSendRequest } from "@/lib/api";

import {
	type ChatCommandActionContext,
	executeCommandInput,
} from "./chat-room-command-actions";
import type { ParsedChatCommand } from "./types/chat-room.types";

export async function executeChatRoomInput(
	context: ChatCommandActionContext & {
		sendMessage(input: {
			sessionId: string;
			message: ChatSendRequest;
		}): Promise<unknown>;
	},
	sessionId: string,
	content: string,
	command: ParsedChatCommand,
): Promise<void> {
	if (command.kind === "none") {
		await context.sendMessage({ sessionId, message: { content } });
		return;
	}
	await executeCommandInput(context, sessionId, content, command);
}
