import {
	assertObjectRecord,
	parseListResponse,
	readBoolean,
	readNullableString,
	readString,
} from "./response-utils";
import type {
	GitHubRepositoriesResponse,
	GitHubRepositoryRecord,
	HealthRequestOptions,
} from "./types/client.types";

const GITHUB_REPOSITORIES_PATH = "/api/github/repositories";

function parseGitHubRepositoryRecord(payload: unknown): GitHubRepositoryRecord {
	const endpoint = GITHUB_REPOSITORIES_PATH;
	const row = assertObjectRecord(payload, endpoint);
	return {
		id: readString(row, "id", endpoint),
		owner: readString(row, "owner", endpoint),
		name: readString(row, "name", endpoint),
		nameWithOwner: readString(row, "nameWithOwner", endpoint),
		defaultBranch: readNullableString(row, "defaultBranch", endpoint),
		isPrivate: readBoolean(row, "isPrivate", endpoint),
	};
}

export function parseGitHubRepositoriesResponse(
	payload: unknown,
): GitHubRepositoriesResponse {
	const endpoint = GITHUB_REPOSITORIES_PATH;
	const row = assertObjectRecord(payload, endpoint);
	return {
		isAvailable: readBoolean(row, "isAvailable", endpoint),
		unavailableReason: readNullableString(row, "unavailableReason", endpoint),
		repositories: parseListResponse(
			row.repositories,
			`${endpoint}:repositories`,
			parseGitHubRepositoryRecord,
		),
	};
}

export interface GitHubApiMethods {
	listGitHubRepositories(
		options?: HealthRequestOptions,
	): Promise<GitHubRepositoriesResponse>;
}

export function createGitHubApiMethods(
	requestWithBase: (
		path: string,
		method: "GET" | "POST" | "PATCH" | "DELETE",
		options?: HealthRequestOptions,
		body?: unknown,
	) => Promise<unknown>,
): GitHubApiMethods {
	return {
		async listGitHubRepositories(options) {
			const payload = await requestWithBase(
				GITHUB_REPOSITORIES_PATH,
				"GET",
				options,
			);
			return parseGitHubRepositoriesResponse(payload);
		},
	};
}
