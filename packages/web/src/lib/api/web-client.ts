import { createApiClient } from "./client";
import type { ApiClient } from "./client.types";

const WEB_SERVER_PROXY_BASE_URL = "/api/server";
const WEB_SERVER_PROXY_WS_URL =
	process.env.NEXT_PUBLIC_DEVOS_SERVER_WS_URL ?? "/api/server/api/cli/stream";

export function createWebApiClient(): ApiClient {
	return createApiClient({
		baseUrl: WEB_SERVER_PROXY_BASE_URL,
		wsUrl: WEB_SERVER_PROXY_WS_URL,
	});
}
