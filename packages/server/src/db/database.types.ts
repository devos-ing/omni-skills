import type { PGlite } from "@electric-sql/pglite";
import type { drizzle } from "drizzle-orm/pglite";
import type * as schema from "./schema";

export interface ServerDatabase {
	client: PGlite;
	db: ReturnType<typeof drizzle<typeof schema>>;
	close(): Promise<void>;
}
