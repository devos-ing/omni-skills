import { assertObjectRecord, readString } from "./response-utils";
import type {
	CurrentWorkspaceRecord,
	HealthRequestOptions,
} from "./types/client.types";

const CURRENT_WORKSPACE_PATH = "/api/workspace/current";

type RequestWithBase = (
	path: string,
	method: "GET" | "POST" | "PATCH" | "DELETE",
	options?: HealthRequestOptions,
	body?: unknown,
) => Promise<unknown>;

export interface WorkspaceApiMethods {
	getCurrentWorkspace(
		options?: HealthRequestOptions,
	): Promise<CurrentWorkspaceRecord>;
}

export function createWorkspaceApiMethods(
	requestWithBase: RequestWithBase,
): WorkspaceApiMethods {
	return {
		async getCurrentWorkspace(options) {
			const payload = await requestWithBase(
				CURRENT_WORKSPACE_PATH,
				"GET",
				options,
			);
			return parseCurrentWorkspaceRecord(payload);
		},
	};
}

export function parseCurrentWorkspaceRecord(
	payload: unknown,
): CurrentWorkspaceRecord {
	const row = assertObjectRecord(payload, CURRENT_WORKSPACE_PATH);
	return {
		workspaceId: readString(row, "workspaceId", CURRENT_WORKSPACE_PATH),
		name: readString(row, "name", CURRENT_WORKSPACE_PATH),
	};
}
