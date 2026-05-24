import type { CliExecutor } from "../app.types";
import { methodNotAllowed } from "./http-utils";
import { jsonSuccess } from "./response";

export async function handleCliRoute(
	request: Request,
	cliExecutor: CliExecutor,
	pathname: string,
): Promise<Response | null> {
	if (pathname === "/api/cli/history") {
		if (request.method !== "GET") {
			return methodNotAllowed();
		}
		return jsonSuccess(cliExecutor.getHistory());
	}

	if (pathname === "/api/computers") {
		if (request.method !== "GET") {
			return methodNotAllowed();
		}
		return jsonSuccess(cliExecutor.listComputers?.() ?? []);
	}

	return null;
}
