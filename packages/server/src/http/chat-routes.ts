import type { ServerDatabase } from "devos-db";
import { z } from "zod";
import type { LocalWorkspaceIdentity } from "../local-workspace";
import type { RealtimeEventPublisher } from "../realtime";
import {
	publishChatAppendResult,
	publishChatSendResult,
	publishChatSessionEvent,
} from "./chat-route-realtime";
import { createChatRouteService } from "./chat-route-service";
import {
	badRequest,
	methodNotAllowed,
	notFound,
	parseObjectJsonBody,
} from "./http-utils";
import { jsonSuccess } from "./response";

const SESSIONS_PATH = "/api/chat/sessions";
const SESSION_PATH = /^\/api\/chat\/sessions\/([^/]+)\/?$/;
const MESSAGES_PATH = /^\/api\/chat\/sessions\/([^/]+)\/messages\/?$/;
const SEND_PATH = /^\/api\/chat\/sessions\/([^/]+)\/send\/?$/;

const answerSchema = z.object({
	question: z.string().trim().min(1),
	answer: z.string().trim().min(1),
});

const sessionCreateSchema = z.object({
	workspaceId: z.string().trim().min(1).optional(),
	projectId: z.string().trim().min(1).nullable().optional(),
	title: z.string().trim().min(1).optional(),
});

const sessionUpdateSchema = z.object({
	projectId: z.string().trim().min(1).nullable().optional(),
	title: z.string().trim().min(1).optional(),
	pendingRequest: z.string().nullable().optional(),
	pendingQuestions: z.array(z.string().trim().min(1)).nullable().optional(),
});

const messageCreateSchema = z.object({
	role: z.enum(["user", "assistant", "system"]),
	kind: z
		.enum(["message", "clarification", "task", "command", "error"])
		.optional(),
	content: z.string().trim().min(1),
	taskId: z.string().trim().min(1).nullable().optional(),
	commandAction: z.string().trim().min(1).nullable().optional(),
	metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const sendMessageSchema = z.object({
	content: z.string().trim().min(1),
	answers: z.array(answerSchema).optional(),
});

export async function handleChatRoute(
	request: Request,
	db: ServerDatabase["db"],
	pathname: string,
	workspacePath: string,
	workspace: LocalWorkspaceIdentity,
	realtimeEvents?: RealtimeEventPublisher,
): Promise<Response | null> {
	const service = createChatRouteService(
		db,
		workspacePath,
		workspace,
		realtimeEvents,
	);
	if (pathname === SESSIONS_PATH) {
		return handleSessionsRoute(request, service, workspace, realtimeEvents);
	}
	const sendMatch = pathname.match(SEND_PATH);
	if (sendMatch?.[1]) {
		return handleSendRoute(
			request,
			service,
			decodeURIComponent(sendMatch[1]),
			realtimeEvents,
		);
	}
	const messagesMatch = pathname.match(MESSAGES_PATH);
	if (messagesMatch?.[1]) {
		return handleMessagesRoute(
			request,
			service,
			decodeURIComponent(messagesMatch[1]),
			realtimeEvents,
		);
	}
	const sessionMatch = pathname.match(SESSION_PATH);
	if (sessionMatch?.[1]) {
		return handleSessionRoute(
			request,
			service,
			decodeURIComponent(sessionMatch[1]),
			realtimeEvents,
		);
	}
	return null;
}

async function handleSessionsRoute(
	request: Request,
	service: ReturnType<typeof createChatRouteService>,
	workspace: LocalWorkspaceIdentity,
	realtimeEvents?: RealtimeEventPublisher,
): Promise<Response> {
	if (request.method === "GET") {
		const workspaceId =
			new URL(request.url).searchParams.get("workspaceId") ?? workspace.id;
		return jsonSuccess(await service.listSessions(workspaceId));
	}
	if (request.method !== "POST") {
		return methodNotAllowed();
	}
	const parsed = await parseBody(request, sessionCreateSchema);
	if (!parsed.ok) {
		return badRequest(parsed.error);
	}
	const session = await service.createSession({
		...parsed.value,
		workspaceId: parsed.value.workspaceId ?? workspace.id,
	});
	publishChatSessionEvent(realtimeEvents, "chat.session.created", session);
	return jsonSuccess(session, { status: 201 });
}

async function handleSessionRoute(
	request: Request,
	service: ReturnType<typeof createChatRouteService>,
	sessionId: string,
	realtimeEvents?: RealtimeEventPublisher,
): Promise<Response> {
	if (request.method !== "PATCH") {
		return methodNotAllowed();
	}
	const parsed = await parseBody(request, sessionUpdateSchema);
	if (!parsed.ok) {
		return badRequest(parsed.error);
	}
	const session = await service.updateSession(sessionId, parsed.value);
	publishChatSessionEvent(realtimeEvents, "chat.session.updated", session);
	return session ? jsonSuccess(session) : notFound("Chat session not found");
}

async function handleMessagesRoute(
	request: Request,
	service: ReturnType<typeof createChatRouteService>,
	sessionId: string,
	realtimeEvents?: RealtimeEventPublisher,
): Promise<Response> {
	if (request.method === "GET") {
		const messages = await service.getMessages(sessionId);
		return messages
			? jsonSuccess(messages)
			: notFound("Chat session not found");
	}
	if (request.method !== "POST") {
		return methodNotAllowed();
	}
	const parsed = await parseBody(request, messageCreateSchema);
	if (!parsed.ok) {
		return badRequest(parsed.error);
	}
	const result = await service.addMessage(sessionId, parsed.value);
	publishChatAppendResult(realtimeEvents, result);
	return result
		? jsonSuccess(result.message, { status: 201 })
		: notFound("Chat session not found");
}

async function handleSendRoute(
	request: Request,
	service: ReturnType<typeof createChatRouteService>,
	sessionId: string,
	realtimeEvents?: RealtimeEventPublisher,
): Promise<Response> {
	if (request.method !== "POST") {
		return methodNotAllowed();
	}
	const parsed = await parseBody(request, sendMessageSchema);
	if (!parsed.ok) {
		return badRequest(parsed.error);
	}
	const result = await service.sendMessage(sessionId, parsed.value);
	publishChatSendResult(realtimeEvents, result);
	return result ? jsonSuccess(result) : notFound("Chat session not found");
}

async function parseBody<T extends z.ZodTypeAny>(
	request: Request,
	schema: T,
): Promise<{ ok: true; value: z.infer<T> } | { ok: false; error: string }> {
	const body = await parseObjectJsonBody(request);
	if (!body.ok) {
		return body;
	}
	const parsed = schema.safeParse(body.value);
	return parsed.success
		? { ok: true, value: parsed.data }
		: { ok: false, error: "Invalid chat payload" };
}
