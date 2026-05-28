import path from "node:path";
import { devosHomeInstanceRoot } from "../config/home-paths";
import type { OnboardInstanceConfig } from "./types/instance-config.types";
import type { SetupInstanceDraft } from "./types/setup.types";

const DEFAULT_INSTANCE_ID = "default";
const DEFAULT_INSTANCE_PORT = 3100;
const DEFAULT_EMBEDDED_POSTGRES_PORT = 54329;

export function createDefaultSetupInstanceDraft(): SetupInstanceDraft {
	const instanceRoot = devosHomeInstanceRoot(DEFAULT_INSTANCE_ID);
	return {
		database: {
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
			logDir: path.join(instanceRoot, "logs"),
		},
		server: {
			port: DEFAULT_INSTANCE_PORT,
			allowedHostnames: [],
			serveUi: true,
		},
		auth: {
			disableSignUp: false,
		},
		telemetry: {
			enabled: true,
		},
		storage: {
			localDiskBaseDir: path.join(instanceRoot, "data", "storage"),
			s3: {
				bucket: "devos",
				region: "us-east-1",
				prefix: "",
				forcePathStyle: false,
			},
		},
		secrets: {
			strictMode: false,
			keyFilePath: path.join(instanceRoot, "secrets", "master.key"),
		},
	};
}

export function createInstanceConfigSections(
	draft: SetupInstanceDraft,
): Pick<
	OnboardInstanceConfig,
	| "auth"
	| "database"
	| "logging"
	| "secrets"
	| "server"
	| "storage"
	| "telemetry"
> {
	return {
		database: {
			mode: "embedded-postgres",
			embeddedPostgresDataDir: draft.database.embeddedPostgresDataDir,
			embeddedPostgresPort: draft.database.embeddedPostgresPort,
			backup: { ...draft.database.backup },
		},
		logging: {
			mode: "file",
			logDir: draft.logging.logDir,
		},
		server: {
			deploymentMode: "local_trusted",
			exposure: "private",
			bind: "loopback",
			host: "127.0.0.1",
			port: draft.server.port,
			allowedHostnames: draft.server.allowedHostnames,
			serveUi: draft.server.serveUi,
		},
		auth: {
			baseUrlMode: "auto",
			disableSignUp: draft.auth.disableSignUp,
		},
		telemetry: {
			enabled: draft.telemetry.enabled,
		},
		storage: {
			provider: "local_disk",
			localDisk: {
				baseDir: draft.storage.localDiskBaseDir,
			},
			s3: { ...draft.storage.s3 },
		},
		secrets: {
			provider: "local_encrypted",
			strictMode: draft.secrets.strictMode,
			localEncrypted: {
				keyFilePath: draft.secrets.keyFilePath,
			},
		},
	};
}
