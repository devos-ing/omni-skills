import type { ChatSendResult } from "../chat/types/chat.types";
import type { RealtimeEventPublisher } from "../realtime";
import { publishChatSendResult } from "./chat-route-realtime";

export function publishChatSendCompletion(
	realtimeEvents: RealtimeEventPublisher | undefined,
	completion: Promise<ChatSendResult>,
): void {
	void completion
		.then((result) => {
			publishChatSendResult(realtimeEvents, result);
		})
		.catch(() => {
			// Stream callbacks publish the failure before the background send rejects.
		});
}
