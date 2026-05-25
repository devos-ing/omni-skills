import { readFile } from "node:fs/promises";
import { DEFAULT_WORKSPACE_NAME, LOCAL_WORKSPACE_ID } from "../setup/constants";
import { instanceConfigPath } from "./home-paths";
import type { WorkspaceRuntimeConfig } from "./types/config.types";

export async function loadInstanceWorkspaceConfig(
	readText: (
		targetPath: string,
		encoding: BufferEncoding,
	) => Promise<string> = readFile,
): Promise<WorkspaceRuntimeConfig> {
	let content: string;
	try {
		content = await readText(instanceConfigPath(), "utf8");
	} catch {
		return defaultWorkspaceConfig();
	}

	try {
		const parsed = JSON.parse(content) as unknown;
		if (!isRecord(parsed) || !isRecord(parsed.workspace)) {
			return defaultWorkspaceConfig();
		}
		const id = parsed.workspace.id;
		const name = parsed.workspace.name;
		return {
			id: isWorkspaceId(id) ? id : LOCAL_WORKSPACE_ID,
			name:
				typeof name === "string" && name.trim()
					? name.trim()
					: DEFAULT_WORKSPACE_NAME,
		};
	} catch {
		return defaultWorkspaceConfig();
	}
}

function defaultWorkspaceConfig(): WorkspaceRuntimeConfig {
	return {
		id: LOCAL_WORKSPACE_ID,
		name: DEFAULT_WORKSPACE_NAME,
	};
}

function isWorkspaceId(value: unknown): value is string {
	return typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
