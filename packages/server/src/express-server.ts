import type { Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, {
	type ErrorRequestHandler,
	type Express,
	type Request as ExpressRequest,
	type Response as ExpressResponse,
} from "express";
import * as OpenApiValidator from "express-openapi-validator";
import swaggerUi from "swagger-ui-express";
import type { RouteHandler } from "./app.types";

const DYNAMIC_PORT_ATTEMPTS = 25;
const DYNAMIC_PORT_MIN = 20_000;
const DYNAMIC_PORT_MAX = 60_000;
const OPENAPI_SPEC_PATH = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../..",
	"openapi.yaml",
);

export function createExpressApp(handler: RouteHandler): Express {
	const app = express();
	app.get("/openapi.yaml", (_request, response) => {
		response.type("application/yaml").sendFile(OPENAPI_SPEC_PATH);
	});
	app.use(
		"/api-docs",
		swaggerUi.serve,
		swaggerUi.setup(undefined, {
			swaggerOptions: { url: "/openapi.yaml" },
		}),
	);
	app.use(express.json());
	app.use(
		OpenApiValidator.middleware({
			apiSpec: OPENAPI_SPEC_PATH,
			validateRequests: true,
			validateResponses: false,
			ignoreUndocumented: false,
		}),
	);
	app.use(async (request, response) => {
		try {
			await sendWebResponse(response, await handler(toWebRequest(request)));
		} catch (error) {
			response.status(500).json({
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});
	app.use(handleExpressError);
	return app;
}

export function listenExpressApp(app: Express, port: number): Promise<Server> {
	if (port !== 0) {
		return listenOnce(app, port);
	}
	return listenWithDynamicPort(app);
}

async function listenWithDynamicPort(app: Express): Promise<Server> {
	let lastError: unknown;
	for (let attempt = 0; attempt < DYNAMIC_PORT_ATTEMPTS; attempt += 1) {
		try {
			return await listenOnce(app, randomDynamicPort());
		} catch (error) {
			if (!isAddrInUseError(error)) {
				throw error;
			}
			lastError = error;
		}
	}
	throw (
		lastError ??
		new Error("Failed to bind dynamic port for Express server adapter")
	);
}

function listenOnce(app: Express, port: number): Promise<Server> {
	return new Promise((resolve, reject) => {
		const server = app.listen(port);
		server.once("listening", () => resolve(server));
		server.once("error", reject);
	});
}

function randomDynamicPort(): number {
	return (
		Math.floor(Math.random() * (DYNAMIC_PORT_MAX - DYNAMIC_PORT_MIN + 1)) +
		DYNAMIC_PORT_MIN
	);
}

function isAddrInUseError(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	return "code" in error && error.code === "EADDRINUSE";
}

function toWebRequest(request: ExpressRequest): Request {
	const url = `${request.protocol}://${request.get("host") ?? "localhost"}${
		request.originalUrl
	}`;
	const body =
		request.method === "GET" || request.method === "HEAD"
			? undefined
			: serializeParsedBody(request.body);
	const headers = toWebHeaders(request);
	if (body !== undefined && !headers.has("content-type")) {
		headers.set("content-type", "application/json");
	}
	return new Request(url, {
		method: request.method,
		headers,
		body: body as BodyInit | undefined,
	});
}

function serializeParsedBody(body: unknown): string | undefined {
	return body === undefined ? undefined : JSON.stringify(body);
}

function toWebHeaders(request: ExpressRequest): Headers {
	const headers = new Headers();
	for (const [key, value] of Object.entries(request.headers)) {
		if (value === undefined) {
			continue;
		}
		if (Array.isArray(value)) {
			for (const item of value) {
				headers.append(key, item);
			}
			continue;
		}
		headers.set(key, value);
	}
	return headers;
}

async function sendWebResponse(
	response: ExpressResponse,
	webResponse: Response,
): Promise<void> {
	response.status(webResponse.status);
	webResponse.headers.forEach((value, key) => {
		response.setHeader(key, value);
	});
	if (!webResponse.body) {
		response.end();
		return;
	}
	const body = await webResponse.arrayBuffer();
	response.send(Buffer.from(body));
}

const handleExpressError: ErrorRequestHandler = (
	error,
	_request,
	response,
	_next,
) => {
	const status = normalizeErrorStatus(error);
	response.status(status).json({ error: normalizeErrorMessage(error, status) });
};

function normalizeErrorStatus(error: unknown): number {
	if (isExpressValidationError(error) && typeof error.status === "number") {
		return error.status;
	}
	return error instanceof SyntaxError ? 400 : 500;
}

function normalizeErrorMessage(error: unknown, status: number): string {
	if (error instanceof SyntaxError && "body" in error) {
		return "Malformed JSON body";
	}
	if (isExpressValidationError(error)) {
		return (
			error.errors?.[0]?.message ??
			error.message ??
			(status === 404 ? "Not Found" : "Request validation failed")
		);
	}
	return error instanceof Error ? error.message : String(error);
}

function isExpressValidationError(error: unknown): error is {
	status?: number;
	message?: string;
	errors?: { message?: string }[];
} {
	return typeof error === "object" && error !== null;
}
