import type { HealthRequestOptions } from "./client.types";

export function assertObjectRecord(
	payload: unknown,
	endpoint: string,
): Record<string, unknown> {
	if (typeof payload !== "object" || payload === null) {
		throw new Error(`Invalid ${endpoint} response payload`);
	}
	return payload as Record<string, unknown>;
}

export function readString(
	record: Record<string, unknown>,
	key: string,
	endpoint: string,
): string {
	const value = record[key];
	if (typeof value !== "string") {
		throw new Error(`Invalid ${endpoint} response field '${key}'`);
	}
	return value;
}

export function readNumber(
	record: Record<string, unknown>,
	key: string,
	endpoint: string,
): number {
	const value = record[key];
	if (typeof value !== "number") {
		throw new Error(`Invalid ${endpoint} response field '${key}'`);
	}
	return value;
}

export function readNullableString(
	record: Record<string, unknown>,
	key: string,
	endpoint: string,
): string | null {
	const value = record[key];
	if (value === null || typeof value === "string") {
		return value;
	}
	throw new Error(`Invalid ${endpoint} response field '${key}'`);
}

export function readStringArray(
	record: Record<string, unknown>,
	key: string,
	endpoint: string,
): string[] {
	const value = record[key];
	if (
		Array.isArray(value) &&
		value.every((entry) => typeof entry === "string")
	) {
		return value;
	}
	throw new Error(`Invalid ${endpoint} response field '${key}'`);
}

export function parseListResponse<T>(
	payload: unknown,
	endpoint: string,
	parseItem: (item: unknown) => T,
): T[] {
	if (!Array.isArray(payload)) {
		throw new Error(`Invalid ${endpoint} response payload`);
	}
	return payload.map(parseItem);
}

export async function requestJson(
	baseUrl: string,
	path: string,
	method: "GET" | "POST" | "PATCH" | "DELETE",
	fetchFn: typeof fetch,
	headers: HeadersInit | undefined,
	options: HealthRequestOptions | undefined,
	body?: unknown,
): Promise<unknown> {
	const requestHeaders = new Headers(headers);
	if (body !== undefined && !requestHeaders.has("content-type")) {
		requestHeaders.set("content-type", "application/json");
	}
	const response = await fetchFn(`${baseUrl}${path}`, {
		method,
		headers: requestHeaders,
		signal: options?.signal,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (!response.ok) {
		throw new Error(`${path} request failed with status ${response.status}`);
	}
	return (await response.json()) as unknown;
}

export function encodePathSegment(value: string): string {
	return encodeURIComponent(value);
}
