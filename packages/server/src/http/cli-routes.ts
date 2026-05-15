import type { CliCommandStreamEvent } from "devos/features/server";
import { z } from "zod";
import type { CliExecutor } from "../app.types";
import type { ServerLogger } from "../logger.types";
import { methodNotAllowed } from "./http-utils";
import { badRequestResponse, jsonSuccess } from "./response";
import { isRecord } from "./zod-utils";

const UNSAFE_RAW_COMMAND_FIELDS = ["command", "cmd", "args", "argv", "shell"];
const dispatchRequestSchema = z
	.object({ action: z.string().trim().min(1) })
	.passthrough();

export async function handleCliRoute(
	request: Request,
	cliExecutor: CliExecutor,
	pathname: string,
	logger?: ServerLogger,
): Promise<Response | null> {
	if (pathname === "/api/cli/history") {
		if (request.method !== "GET") {
			return methodNotAllowed();
		}
		return jsonSuccess(cliExecutor.getHistory());
	}

	if (pathname === "/api/cli/dispatch") {
		if (request.method !== "POST") {
			return methodNotAllowed();
		}
		const parsed = await parseDispatchRequest(request);
		if (parsed.status === "error") {
			return badRequestResponse(parsed.error);
		}
		logger?.info(
			{
				method: request.method,
				path: pathname,
				action: parsed.request.action,
				requestKeys: Object.keys(parsed.request).sort(),
			},
			"CLI dispatch executed",
		);
		if (parsed.stream) {
			if (!cliExecutor.executeStream) {
				return badRequestResponse("CLI streaming is not configured");
			}
			return createDispatchStreamResponse(cliExecutor, parsed.request);
		}
		const result = await cliExecutor.execute(parsed.request);
		return jsonSuccess(result, {
			status: result.status === "rejected" ? 400 : 200,
		});
	}

	return null;
}

async function parseDispatchRequest(request: Request): Promise<
	| {
			status: "ok";
			stream: boolean;
			request: Record<string, unknown> & { action: string };
	  }
	| { status: "error"; error: string }
> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return { status: "error", error: "Malformed JSON body" };
	}

	if (!isRecord(body)) {
		return {
			status: "error",
			error: "Malformed dispatch request: expected object body",
		};
	}
	if (typeof body.action !== "string" || body.action.trim().length === 0) {
		return {
			status: "error",
			error: "Malformed dispatch request: action must be a non-empty string",
		};
	}
	if (body.stream !== undefined && typeof body.stream !== "boolean") {
		return {
			status: "error",
			error: "Malformed dispatch request: stream must be a boolean",
		};
	}
	for (const field of UNSAFE_RAW_COMMAND_FIELDS) {
		if (field in body) {
			return {
				status: "error",
				error: `Unsafe dispatch request: raw command field '${field}' is not allowed`,
			};
		}
	}
	const { stream, ...dispatchBody } = body;
	const result = dispatchRequestSchema.safeParse(dispatchBody);
	if (!result.success) {
		return {
			status: "error",
			error: "Malformed dispatch request: action must be a non-empty string",
		};
	}

	return {
		status: "ok",
		stream: stream === true,
		request: result.data,
	};
}

function createDispatchStreamResponse(
	cliExecutor: CliExecutor,
	request: Record<string, unknown> & { action: string },
): Response {
	const encoder = new TextEncoder();
	let closed = false;
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			const emit = (event: CliCommandStreamEvent) => {
				if (closed) {
					return;
				}
				controller.enqueue(encoder.encode(formatServerSentEvent(event)));
				if (event.type === "complete") {
					closed = true;
					controller.close();
				}
			};
			void cliExecutor.executeStream?.(request, emit).catch((error) => {
				if (closed) {
					return;
				}
				emit({
					type: "error",
					error: error instanceof Error ? error.message : String(error),
				});
				closed = true;
				controller.close();
			});
		},
	});
	return new Response(body, {
		headers: {
			"cache-control": "no-cache",
			connection: "keep-alive",
			"content-type": "text/event-stream; charset=utf-8",
		},
	});
}

function formatServerSentEvent(event: CliCommandStreamEvent): string {
	const { type, ...data } = event;
	return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}
