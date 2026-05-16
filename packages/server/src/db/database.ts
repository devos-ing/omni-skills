import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { CREATE_SCHEMA_SQL } from "./bootstrap-schema";
import type {
	InitializeServerDatabaseOptions,
	ServerDatabase,
	ServerDatabaseInitializationPhase,
} from "./database.types";
import { runMigrations } from "./migrations";
import * as schema from "./schema";

interface InitializationErrorInput {
	cause: unknown;
	databasePath: string;
	phase: ServerDatabaseInitializationPhase;
}

interface ServerDatabaseInitializationDependencies {
	clientFactory?: ServerDatabaseClientFactory;
	migrationRunner?: ServerDatabaseMigrationRunner;
}

type ServerDatabaseClientFactory = (
	databasePath: string,
	options: InitializeServerDatabaseOptions,
) => PGlite;

type ServerDatabaseMigrationRunner = (client: PGlite) => Promise<void>;

export class ServerDatabaseInitializationError extends Error {
	readonly databasePath: string;
	readonly phase: ServerDatabaseInitializationPhase;

	constructor(input: InitializationErrorInput) {
		const causeMessage =
			input.cause instanceof Error ? input.cause.message : String(input.cause);
		super(
			`Failed to initialize server database at ${input.databasePath} during ${input.phase}: ${causeMessage}`,
			{ cause: input.cause },
		);
		this.name = "ServerDatabaseInitializationError";
		this.databasePath = input.databasePath;
		this.phase = input.phase;
	}
}

export async function initializeServerDatabase(
	databasePath: string,
	options: InitializeServerDatabaseOptions = {},
): Promise<ServerDatabase> {
	return initializeServerDatabaseWithDependencies(databasePath, options);
}

export async function initializeServerDatabaseWithDependencies(
	databasePath: string,
	options: InitializeServerDatabaseOptions = {},
	dependencies: ServerDatabaseInitializationDependencies = {},
): Promise<ServerDatabase> {
	const resolvedPath = path.resolve(databasePath);
	let client: PGlite | undefined;
	let phase: ServerDatabaseInitializationPhase = "create_directory";

	try {
		await mkdir(path.dirname(resolvedPath), { recursive: true });

		phase = "create_client";
		client = createServerDatabaseClient(resolvedPath, options, dependencies);

		phase = "wait_ready";
		await client.waitReady;

		phase = "bootstrap_schema";
		await client.exec(CREATE_SCHEMA_SQL);

		phase = "run_migrations";
		await (dependencies.migrationRunner ?? runMigrations)(client);

		phase = "bind_drizzle";
		const initializedClient = client;
		const db = drizzle({ client: initializedClient, schema });
		return {
			client: initializedClient,
			db,
			async close() {
				await initializedClient.close();
			},
		};
	} catch (error) {
		await closePartialClient(client);
		throw new ServerDatabaseInitializationError({
			cause: error,
			databasePath: resolvedPath,
			phase,
		});
	}
}

function createServerDatabaseClient(
	databasePath: string,
	options: InitializeServerDatabaseOptions,
	dependencies: ServerDatabaseInitializationDependencies,
): PGlite {
	if (dependencies.clientFactory) {
		return dependencies.clientFactory(databasePath, options);
	}
	return new PGlite(databasePath, { debug: options.pgliteDebug });
}

async function closePartialClient(client: PGlite | undefined): Promise<void> {
	if (!client || client.closed) {
		return;
	}
	try {
		await client.close();
	} catch {
		// Preserve the startup failure as the primary error.
	}
}
