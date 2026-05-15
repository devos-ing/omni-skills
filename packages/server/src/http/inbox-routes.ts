import type { ServerDatabase } from "../db";
import { createInboxRepository } from "../inbox";
import {
	badRequest,
	isForeignKeyError,
	methodNotAllowed,
	parseObjectJsonBody,
} from "./http-utils";
import {
	parseCreateInboxMessagePayload,
	parseInboxMessageScopeInput,
} from "./inbox-message-schemas";

const INBOX_MESSAGES_PATH = "/api/inbox/messages";

export async function handleInboxMessagesRoute(
	request: Request,
	db: ServerDatabase["db"],
	pathname: string,
): Promise<Response | null> {
	if (pathname !== INBOX_MESSAGES_PATH) {
		return null;
	}
	const inboxRepository = createInboxRepository(db);

	if (request.method === "GET") {
		const url = new URL(request.url);
		const scope = parseInboxMessageScopeInput({
			workspaceId: url.searchParams.get("workspaceId"),
			userId: url.searchParams.get("userId"),
			runId: url.searchParams.get("runId"),
		});
		if (!scope.ok) {
			return badRequest(scope.error);
		}
		return Response.json(await inboxRepository.listInboxMessages(scope.value));
	}

	if (request.method === "POST") {
		const parsedBody = await parseObjectJsonBody(request);
		if (!parsedBody.ok) {
			return badRequest(parsedBody.error);
		}
		const payload = parseCreateInboxMessagePayload(parsedBody.value);
		if (!payload.ok) {
			return badRequest(payload.error);
		}
		try {
			const created = await inboxRepository.createInboxMessage(payload.value);
			return Response.json(created, { status: 201 });
		} catch (error) {
			return isForeignKeyError(error)
				? badRequest("Foreign key constraint failed")
				: badRequest("Invalid inbox message payload");
		}
	}

	return methodNotAllowed();
}
