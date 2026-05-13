import type {
	CliCommandExecutionHistoryEntry,
	CliCommandExecutionResult,
	CliCommandRequest,
} from "adhdai/features/server";
import type { ServerDatabase } from "./db";

export interface CliExecutor {
	execute(request: CliCommandRequest): Promise<CliCommandExecutionResult>;
	getHistory(): CliCommandExecutionHistoryEntry[];
}

export interface AppDeps {
	cliExecutor: CliExecutor;
	persistence: ServerDatabase;
}

export type RouteHandler = (request: Request) => Response | Promise<Response>;
