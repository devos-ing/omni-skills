import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	devosHomeInstanceRoot,
	instanceConfigPath,
} from "../config/home-paths";
import { INSTANCE_CONFIG_FILE } from "./constants";
import type {
	InstanceConfigLoadResult,
	OnboardInstanceConfig,
} from "./instance-config.types";

const DEFAULT_INSTANCE_ID = "default";
const DEFAULT_INSTANCE_PORT = 3100;
const DEFAULT_EMBEDDED_POSTGRES_PORT = 54329;

export function renderInstanceConfig(
	cwd: string,
	updatedAt = new Date().toISOString(),
): string {
	return `${JSON.stringify(createInstanceConfig(cwd, updatedAt), null, "\t")}\n`;
}

export function renderInstanceConfigDocument(
	config: OnboardInstanceConfig,
): string {
	return `${JSON.stringify(config, null, "\t")}\n`;
}

export async function saveInstanceConfig(
	config: OnboardInstanceConfig,
	writeText: (
		targetPath: string,
		content: string,
		encoding: BufferEncoding,
	) => Promise<void> = writeFile,
): Promise<void> {
	config.$meta.updatedAt = new Date().toISOString();
	await writeText(
		instanceConfigPath(),
		renderInstanceConfigDocument(config),
		"utf8",
	);
}

export async function loadInstanceConfig(
	_cwd: string,
	readText: (
		targetPath: string,
		encoding: BufferEncoding,
	) => Promise<string> = readFile,
): Promise<InstanceConfigLoadResult> {
	const configPath = instanceConfigPath();
	let content: string;
	try {
		content = await readText(configPath, "utf8");
	} catch {
		return {
			ok: false,
			message: `${configPath} missing or inaccessible`,
		};
	}

	try {
		const parsed = JSON.parse(content) as unknown;
		const validationMessage = validateInstanceConfig(parsed);
		if (validationMessage) {
			return { ok: false, message: validationMessage };
		}
		return { ok: true, config: parsed as OnboardInstanceConfig };
	} catch (error) {
		return {
			ok: false,
			message: `${configPath} is malformed: ${
				error instanceof Error ? error.message : String(error)
			}`,
		};
	}
}

export function createInstanceConfig(
	_cwd: string,
	updatedAt: string,
): OnboardInstanceConfig {
	const instanceRoot = devosHomeInstanceRoot(DEFAULT_INSTANCE_ID);
	return {
		$meta: {
			version: 1,
			updatedAt,
			source: "onboard",
		},
		database: {
			mode: "embedded-postgres",
			embeddedPostgresDataDir: path.join(instanceRoot, "db"),
			embeddedPostgresPort: DEFAULT_EMBEDDED_POSTGRES_PORT,
			backup: {
				enabled: true,
				intervalMinutes: 60,
				retentionDays: 30,
				dir: path.join(instanceRoot, "data", "backups"),
			},
		},
		logging: {
			mode: "file",
			logDir: path.join(instanceRoot, "logs"),
		},
		server: {
			deploymentMode: "local_trusted",
			exposure: "private",
			bind: "loopback",
			host: "127.0.0.1",
			port: DEFAULT_INSTANCE_PORT,
			allowedHostnames: [],
			serveUi: true,
		},
		auth: {
			baseUrlMode: "auto",
			disableSignUp: false,
		},
		telemetry: {
			enabled: true,
		},
		storage: {
			provider: "local_disk",
			localDisk: {
				baseDir: path.join(instanceRoot, "data", "storage"),
			},
			s3: {
				bucket: "devos",
				region: "us-east-1",
				prefix: "",
				forcePathStyle: false,
			},
		},
		secrets: {
			provider: "local_encrypted",
			strictMode: false,
			localEncrypted: {
				keyFilePath: path.join(instanceRoot, "secrets", "master.key"),
			},
		},
		plugins: {
			installed: [],
		},
	};
}

function validateInstanceConfig(config: unknown): string | undefined {
	if (!isRecord(config)) return `${INSTANCE_CONFIG_FILE} must be an object`;
	const storage = config.storage;
	if (!isRecord(storage) || !isRecord(storage.localDisk)) {
		return `${INSTANCE_CONFIG_FILE} is missing storage.localDisk`;
	}
	if (typeof storage.localDisk.baseDir !== "string") {
		return `${INSTANCE_CONFIG_FILE} is missing storage.localDisk.baseDir`;
	}

	const database = config.database;
	if (!isRecord(database)) return `${INSTANCE_CONFIG_FILE} is missing database`;
	if (typeof database.embeddedPostgresDataDir !== "string") {
		return `${INSTANCE_CONFIG_FILE} is missing database.embeddedPostgresDataDir`;
	}
	if (typeof database.embeddedPostgresPort !== "number") {
		return `${INSTANCE_CONFIG_FILE} is missing database.embeddedPostgresPort`;
	}

	const logging = config.logging;
	if (!isRecord(logging) || typeof logging.logDir !== "string") {
		return `${INSTANCE_CONFIG_FILE} is missing logging.logDir`;
	}

	const server = config.server;
	if (!isRecord(server) || typeof server.port !== "number") {
		return `${INSTANCE_CONFIG_FILE} is missing server.port`;
	}
	const plugins = config.plugins;
	if (plugins !== undefined) {
		if (!isRecord(plugins) || !Array.isArray(plugins.installed)) {
			return `${INSTANCE_CONFIG_FILE} plugins.installed must be an array`;
		}
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
