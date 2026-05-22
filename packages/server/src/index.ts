import { initializeServerDatabase } from "devos-db";
import { loadServerStartupConfig } from "devos/features/config";
import { createHandleRequest } from "./app";
import { createBoardRepository } from "./board";
import { createExpressApp, listenExpressApp } from "./express-server";
import type { ServerInstance } from "./express-server.types";
import {
	logger,
	normalizeError,
	setupServerProcessErrorHandlers,
} from "./logger";
import { createNotificationSender } from "./notifications/notification-sender";
import {
	createNotificationConfigFromEnv,
	createNotificationService,
} from "./notifications/notifications-service";
import { createResendClient } from "./notifications/resend-client";
import { createRealtimeEventBus } from "./realtime";
import { createReadRepositories } from "./repositories";
import {
	resolveServerDatabasePath,
	resolveServerWorkspacePath,
} from "./startup-paths";
import { WORKFLOW_DATA_WS_PATH } from "./workflow-data";
import { createWorkflowCommandBroker } from "./workflow-data/workflow-command-broker";
import { attachWorkflowDataSocket } from "./workflow-data/workflow-data-socket";
import { attachRealtimeEventsSocket } from "./ws/realtime-events";

const DEFAULT_SERVER_PORT = 3001;

export async function startServer(
	port = resolveServerPort(process.env),
): Promise<ServerInstance> {
	const cwd = process.cwd();
	const workspacePath = resolveServerWorkspacePath(process.env);
	const config = await loadServerStartupConfig(workspacePath);
	const databasePath = resolveServerDatabasePath(
		process.env,
		workspacePath,
		config,
	);
	const pgliteDebug = resolvePgliteDebug(process.env);
	logger.info({ port, databasePath, cwd, workspacePath }, "Starting server");
	const serverDatabase = await initializeServerDatabase(databasePath, {
		pgliteDebug,
	});
	const commandBroker = createWorkflowCommandBroker();
	const realtimeEvents = createRealtimeEventBus();
	const app = createExpressApp(
		createHandleRequest({
			db: serverDatabase.db,
			cliExecutor: commandBroker,
			boardRepository: createBoardRepository(serverDatabase.db),
			notificationSender: createNotificationSender({
				resendApiKey: process.env.RESEND_API_KEY,
			}),
			notificationService: createNotificationService({
				config: createNotificationConfigFromEnv(process.env),
				resendClient: createResendClient(process.env.RESEND_API_KEY ?? ""),
			}),
			realtimeEvents,
			repositories: createReadRepositories(serverDatabase),
		}),
		{ logger },
	);
	const server = await listenExpressApp(app, port);
	const realtimeEventsSocket = attachRealtimeEventsSocket({
		server,
		path: "/api/events",
		eventBus: realtimeEvents,
	});
	const workflowDataSocket = attachWorkflowDataSocket({
		server,
		path: WORKFLOW_DATA_WS_PATH,
		db: serverDatabase.db,
		commandBroker,
		realtimeEvents,
	});
	server.once("close", () => {
		void realtimeEventsSocket.close();
		void workflowDataSocket.close();
	});
	const address = server.address();
	const listeningPort = typeof address === "object" ? address?.port : port;
	logger.info(
		{ port: listeningPort ?? port, databasePath, cwd, workspacePath },
		"Server started",
	);
	return server;
}

if (import.meta.main) {
	setupServerProcessErrorHandlers();
	startServer().catch((error) => {
		logger.fatal({ err: normalizeError(error) }, "Server startup failed");
		process.exit(1);
	});
}

function resolveServerPort(env: NodeJS.ProcessEnv): number {
	const rawPort = DEFAULT_SERVER_PORT;
	// if (!rawPort) {
	// 	return DEFAULT_SERVER_PORT;
	// }
	const port = Number(rawPort);
	if (!Number.isInteger(port) || port <= 0) {
		throw new Error("Server port must be a positive integer");
	}
	return port;
}

function resolvePgliteDebug(env: NodeJS.ProcessEnv): 1 | undefined {
	if (env.PIV_PGLITE_DEBUG === "1") {
		return 1;
	}
	return undefined;
}
