import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	instanceConfigPath,
	loadServerStartupConfig,
} from "../src/features/config";

let tempDir: string | undefined;
let tempHomeDir: string | undefined;
let previousDatabasePath: string | undefined;
let previousHome: string | undefined;

beforeEach(() => {
	previousDatabasePath = process.env.PIV_SERVER_DATABASE_PATH;
	previousHome = process.env.HOME;
});

afterEach(async () => {
	if (previousDatabasePath === undefined) {
		process.env.PIV_SERVER_DATABASE_PATH = undefined;
	} else {
		process.env.PIV_SERVER_DATABASE_PATH = previousDatabasePath;
	}
	previousDatabasePath = undefined;
	if (previousHome === undefined) {
		process.env.HOME = undefined;
	} else {
		process.env.HOME = previousHome;
	}
	previousHome = undefined;
	if (tempDir) {
		await rm(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
	if (tempHomeDir) {
		await rm(tempHomeDir, { recursive: true, force: true });
		tempHomeDir = undefined;
	}
});

describe("loadServerStartupConfig", () => {
	it("resolves startup config without opening server DB metadata", async () => {
		tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-server-startup-config-"),
		);
		const databasePath = path.join(tempDir, "server-db-file");
		process.env.PIV_SERVER_DATABASE_PATH = databasePath;
		await writeFile(databasePath, "not an embedded postgres directory");

		const config = await loadServerStartupConfig(tempDir);

		expect(config.projects[0]?.server.database.databasePath).toBe(databasePath);
		expect(config.server.database.port).toBe(54329);
	});

	it("uses the instance embedded postgres data dir when env path is unset", async () => {
		tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-server-startup-config-"),
		);
		tempHomeDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-server-startup-home-"),
		);
		process.env.HOME = tempHomeDir;
		process.env.PIV_SERVER_DATABASE_PATH = "";
		const databasePath = path.join(tempHomeDir, "instances", "default", "db");
		await writeInstanceConfig(databasePath);

		const config = await loadServerStartupConfig(tempDir);

		expect(config.projects[0]?.server.database.databasePath).toBe(databasePath);
		expect(config.projects[0]?.server.database.port).toBe(54330);
		expect(config.server.database.databasePath).toBe(databasePath);
		expect(config.server.database.port).toBe(54330);
		expect(config.workspace).toEqual({
			id: "owner-1",
			name: "Default Workspace",
		});
	});

	it("loads workspace identity from instance config", async () => {
		tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-server-startup-config-"),
		);
		tempHomeDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-server-startup-home-"),
		);
		process.env.HOME = tempHomeDir;
		process.env.PIV_SERVER_DATABASE_PATH = "";
		await writeInstanceConfig(
			path.join(tempHomeDir, "instances", "default", "db"),
			{ id: "workspace-abcdef1234567890", name: "Roy Lab" },
		);

		const config = await loadServerStartupConfig(tempDir);

		expect(config.workspace).toEqual({
			id: "workspace-abcdef1234567890",
			name: "Roy Lab",
		});
	});

	it("keeps PIV_SERVER_DATABASE_PATH ahead of instance config", async () => {
		tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-server-startup-config-"),
		);
		tempHomeDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-server-startup-home-"),
		);
		process.env.HOME = tempHomeDir;
		const envDatabasePath = path.join(tempDir, "from-env", "server-db");
		process.env.PIV_SERVER_DATABASE_PATH = envDatabasePath;
		await writeInstanceConfig(
			path.join(tempHomeDir, "instances", "default", "db"),
		);

		const config = await loadServerStartupConfig(tempDir);

		expect(config.projects[0]?.server.database.databasePath).toBe(
			envDatabasePath,
		);
		expect(config.projects[0]?.server.database.port).toBe(54329);
		expect(config.server.database.databasePath).toBe(envDatabasePath);
		expect(config.server.database.port).toBe(54329);
	});

	it("falls back to workspace-local db when instance config is missing", async () => {
		tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-server-startup-config-"),
		);
		tempHomeDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-server-startup-home-"),
		);
		process.env.HOME = tempHomeDir;
		process.env.PIV_SERVER_DATABASE_PATH = "";

		const config = await loadServerStartupConfig(tempDir);
		const fallbackPath = path.join(tempDir, ".devos", "config", "server-db");

		expect(config.projects[0]?.server.database.databasePath).toBe(fallbackPath);
		expect(config.projects[0]?.server.database.port).toBe(54329);
		expect(config.server.database.databasePath).toBe(fallbackPath);
		expect(config.server.database.port).toBe(54329);
	});
});

async function writeInstanceConfig(
	databasePath: string,
	workspace?: { id: string; name: string },
): Promise<void> {
	await mkdir(path.dirname(instanceConfigPath()), { recursive: true });
	await writeFile(
		instanceConfigPath(),
		JSON.stringify({
			workspace,
			database: {
				embeddedPostgresDataDir: databasePath,
				embeddedPostgresPort: 54330,
			},
		}),
	);
}
