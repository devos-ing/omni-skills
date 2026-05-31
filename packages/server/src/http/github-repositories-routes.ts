import { runCommand } from "adapters";
import { methodNotAllowed } from "./http-utils";
import type {
	GitHubRepositoriesResponse,
	GitHubRepositoryCommandRunner,
	GitHubRepositoryRecord,
} from "./types/github-repositories-api.types";

const GITHUB_REPOSITORIES_PATH = "/api/github/repositories";
const UNAVAILABLE_REASON = "GitHub repositories unavailable";

interface GhRepositoryJson {
	nameWithOwner?: unknown;
	defaultBranchRef?: { name?: unknown } | null;
	isPrivate?: unknown;
}

export async function handleGitHubRepositoriesRoute(
	request: Request,
	pathname: string,
	workspacePath: string,
	commandRunner: GitHubRepositoryCommandRunner = runCommand,
): Promise<Response | null> {
	if (pathname !== GITHUB_REPOSITORIES_PATH) {
		return null;
	}
	if (request.method !== "GET") {
		return methodNotAllowed();
	}
	const result = await commandRunner("gh", buildGhRepoListArgs(request), {
		cwd: workspacePath,
		timeoutMs: 10000,
	});
	return Response.json(mapGitHubRepositoryResult(result));
}

function buildGhRepoListArgs(request: Request): string[] {
	const owner = new URL(request.url).searchParams.get("owner")?.trim();
	return [
		"repo",
		"list",
		...(owner ? [owner] : []),
		"--limit",
		"100",
		"--json",
		"nameWithOwner,defaultBranchRef,isPrivate",
	];
}

function mapGitHubRepositoryResult(result: {
	code: number;
	stdout: string;
}): GitHubRepositoriesResponse {
	if (result.code !== 0) {
		return unavailableResponse();
	}
	try {
		const payload = JSON.parse(result.stdout) as unknown;
		if (!Array.isArray(payload)) {
			return unavailableResponse();
		}
		return {
			isAvailable: true,
			unavailableReason: null,
			repositories: payload.flatMap(parseRepository),
		};
	} catch {
		return unavailableResponse();
	}
}

function parseRepository(value: unknown): GitHubRepositoryRecord[] {
	if (!isGhRepositoryJson(value)) {
		return [];
	}
	const [owner, name] = value.nameWithOwner.split("/");
	if (!owner || !name) {
		return [];
	}
	return [
		{
			id: value.nameWithOwner,
			owner,
			name,
			nameWithOwner: value.nameWithOwner,
			defaultBranch:
				typeof value.defaultBranchRef?.name === "string"
					? value.defaultBranchRef.name
					: null,
			isPrivate: value.isPrivate === true,
		},
	];
}

function isGhRepositoryJson(value: unknown): value is GhRepositoryJson & {
	nameWithOwner: string;
} {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as GhRepositoryJson).nameWithOwner === "string"
	);
}

function unavailableResponse(): GitHubRepositoriesResponse {
	return {
		isAvailable: false,
		unavailableReason: UNAVAILABLE_REASON,
		repositories: [],
	};
}
