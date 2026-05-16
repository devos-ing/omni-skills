import type { PGlite } from "@electric-sql/pglite";
import type { DebugLevel } from "@electric-sql/pglite";
import type { drizzle } from "drizzle-orm/pglite";
import type * as schema from "./schema";

export type ServerDatabaseInitializationPhase =
	| "create_directory"
	| "create_client"
	| "wait_ready"
	| "bootstrap_schema"
	| "run_migrations"
	| "bind_drizzle";

export interface InitializeServerDatabaseOptions {
	pgliteDebug?: DebugLevel;
}

export interface ServerDatabase {
	client: PGlite;
	db: ReturnType<typeof drizzle<typeof schema>>;
	close(): Promise<void>;
}
