import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { ServerDatabase } from "./database.types";
import * as schema from "./schema";

const CREATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS token_usage (
	id text PRIMARY KEY,
	run_id text NOT NULL,
	stage text NOT NULL,
	input_tokens integer NOT NULL,
	output_tokens integer NOT NULL,
	total_tokens integer NOT NULL,
	recorded_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
	id text PRIMARY KEY,
	project_id text NOT NULL,
	issue_key text NOT NULL,
	stage text NOT NULL,
	status text NOT NULL,
	created_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS agents (
	id text PRIMARY KEY,
	name text NOT NULL,
	backend text NOT NULL,
	model text NOT NULL,
	created_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS skills (
	id text PRIMARY KEY,
	name text NOT NULL,
	description text NOT NULL,
	source text NOT NULL,
	updated_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS command_history (
	id text PRIMARY KEY,
	command text NOT NULL,
	exit_code integer NOT NULL,
	executed_at timestamp NOT NULL
);
`;

export async function initializeServerDatabase(
	databasePath: string,
): Promise<ServerDatabase> {
	const resolvedPath = path.resolve(databasePath);
	await mkdir(path.dirname(resolvedPath), { recursive: true });
	const client = new PGlite(resolvedPath);
	await client.exec(CREATE_SCHEMA_SQL);
	const db = drizzle({ client, schema });
	return {
		client,
		db,
		async close() {
			await client.close();
		},
	};
}
