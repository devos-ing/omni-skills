import path from "node:path";
import { loadConfig } from "devos/features/config";
import { CliCommandExecutor } from "devos/features/server/cli-command-executor";
import { createHandleRequest } from "./app";
import { createBoardRepository } from "./board";
import { initializeServerDatabase } from "./db";
import { createExpressApp, listenExpressApp } from "./express-server";
import type { ServerInstance } from "./express-server.types";
import { startLinearTaskPollingScheduler } from "./features/polling";
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

const DEFAULT_SERVER_DB_PATH = path.join(
	process.cwd(),
	".devos",
	"config",
	"server-db",
);
const DEFAULT_SERVER_PORT = 3001;

export async function startServer(
	port = resolveServerPort(process.env),
): Promise<ServerInstance> {
	const databasePath =
		process.env.PIV_SERVER_DATABASE_PATH ?? DEFAULT_SERVER_DB_PATH;
	const cwd = process.cwd();
	const config = await loadConfig(cwd);
	logger.info({ port, databasePath, cwd }, "Starting server");
	const serverDatabase = await initializeServerDatabase(databasePath);
	const cliExecutor = new CliCommandExecutor({
		cwd,
		command: "npx",
		baseArgs: ["devos"],
	});
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
			logger,
		}),
	);
	const linearPolling = startLinearTaskPollingScheduler({
		config,
		cliExecutor,
		logger,
	});
	const server = await listenExpressApp(app, port);
	server.once("close", () => {
		linearPolling.stop();
	});
	const address = server.address();
	const listeningPort = typeof address === "object" ? address?.port : port;
	logger.info(
		{ port: listeningPort ?? port, databasePath, cwd },
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
	const rawPort = env.PIV_SERVER_PORT ?? env.PORT;
	if (!rawPort) {
		return DEFAULT_SERVER_PORT;
	}
	const port = Number(rawPort);
	if (!Number.isInteger(port) || port <= 0) {
		throw new Error("Server port must be a positive integer");
	}
	return port;
}
