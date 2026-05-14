import type { JsonParseResult, MethodCheckResult } from "./request.types";
import { methodNotAllowedResponse } from "./response";

export function getPathname(request: Request): string {
	return new URL(request.url).pathname;
}

export function matchesPath(request: Request, pathname: string): boolean {
	return getPathname(request) === pathname;
}

export function ensureMethod(
	request: Request,
	expectedMethod: string,
): MethodCheckResult {
	if (request.method === expectedMethod) {
		return { status: "ok" };
	}
	return {
		status: "error",
		response: methodNotAllowedResponse(),
	};
}

export async function parseJsonBody<T = unknown>(
	request: Request,
): Promise<JsonParseResult<T>> {
	try {
		const value = (await request.json()) as T;
		return { status: "ok", value };
	} catch {
		return { status: "error", error: "Malformed JSON body" };
	}
}
