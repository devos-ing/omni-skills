import { loadConfig } from "devos/features/config";
import { createHandleRequest } from "./app";
import { createBoardRepository } from "./board";
import { createCliDaemonClient } from "./daemon/daemon-client";
import { initializeServerDatabase } from "./db";
import { createExpressApp, listenExpressApp } from "./express-server";
import type { ServerInstance } from "./express-server.types";
import { startInternalTaskPollingScheduler } from "./features/polling";
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
import { createReadRepositories } from "./repositories";
import {
	resolveServerDatabasePath,
	resolveServerWorkspacePath,
} from "./startup-paths";
import { attachCliStreamProxy } from "./ws/cli-stream-proxy";

const DEFAULT_SERVER_PORT = 3001;
const DEFAULT_CLI_DAEMON_WS_URL = "ws://127.0.0.1:3002";

export async function startServer(
	port = resolveServerPort(process.env),
): Promise<ServerInstance> {
	const cwd = process.cwd();
	const workspacePath = resolveServerWorkspacePath(process.env);
	const config = await loadConfig(workspacePath);
	const databasePath = resolveServerDatabasePath(
		process.env,
		workspacePath,
		config,
	);
	const daemonUrl =
		process.env.DEVOS_CLI_DAEMON_WS_URL ?? DEFAULT_CLI_DAEMON_WS_URL;
	const pgliteDebug = resolvePgliteDebug(process.env);
	logger.info(
		{ port, databasePath, cwd, workspacePath, daemonUrl },
		"Starting server",
	);
	const serverDatabase = await initializeServerDatabase(databasePath, {
		pgliteDebug,
	});
	const cliExecutor = createCliDaemonClient({ url: daemonUrl });
	const app = createExpressApp(
		createHandleRequest({
			db: serverDatabase.db,
			cliExecutor,
			boardRepository: createBoardRepository(serverDatabase.db),
			notificationSender: createNotificationSender({
				resendApiKey: process.env.RESEND_API_KEY,
			}),
			notificationService: createNotificationService({
				config: createNotificationConfigFromEnv(process.env),
				resendClient: createResendClient(process.env.RESEND_API_KEY ?? ""),
			}),
			repositories: createReadRepositories(serverDatabase),
		}),
		{ logger },
	);
	const taskPolling = startInternalTaskPollingScheduler({
		config,
		db: serverDatabase.db,
		cliExecutor,
		logger,
	});
	const server = await listenExpressApp(app, port);
	const cliStreamProxy = attachCliStreamProxy({
		server,
		path: "/api/cli/stream",
		daemonUrl,
	});
	server.once("close", () => {
		taskPolling.stop();
		void cliStreamProxy.close();
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
