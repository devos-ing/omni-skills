import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { saveSqliteEnv } from "../config";
import { ENV_FILE, INSTANCE_CONFIG_FILE, LOCAL_CONFIG_FILE } from "./constants";
import {
	buildDatabaseEnvUpdates,
	buildEnvUpdates,
	mergeEnvFile,
} from "./env-file";
import {
	createInstanceConfig,
	renderInstanceConfigDocument,
} from "./instance-config";
import type { OnboardInstanceConfig } from "./instance-config.types";
import { renderLocalConfig } from "./local-config";
import { saveSetupProjectMetadata } from "./project-metadata";
import type { SetupDraft } from "./setup.types";
import { readExistingFile } from "./wizard-helpers";

export async function writeSetupFiles(
	cwd: string,
	draft: SetupDraft,
): Promise<void> {
	const envPath = path.join(cwd, ENV_FILE);
	const configPath = path.join(cwd, LOCAL_CONFIG_FILE);
	const instanceConfigPath = path.join(cwd, INSTANCE_CONFIG_FILE);
	const existingEnv = await readExistingFile(envPath);
	const jwtSecret = randomBytes(32).toString("base64url");
	const envUpdates = { ...buildEnvUpdates(draft), JWT_SECRET: jwtSecret };
	const databaseEnvUpdates = {
		...buildDatabaseEnvUpdates(draft),
		...envUpdates,
	};
	await writeFile(envPath, mergeEnvFile(existingEnv, envUpdates));
	await saveSqliteEnv(cwd, databaseEnvUpdates);
	await saveSetupProjectMetadata(cwd, draft);
	await writeFile(configPath, renderLocalConfig(draft));
	const instanceConfig = createInstanceConfig(cwd, new Date().toISOString());
	await mkdir(path.dirname(instanceConfigPath), { recursive: true });
	await createLocalInstanceDirectories(instanceConfig);
	await writeFile(
		instanceConfigPath,
		renderInstanceConfigDocument(instanceConfig),
	);
}

async function createLocalInstanceDirectories(
	config: OnboardInstanceConfig,
): Promise<void> {
	await Promise.all([
		mkdir(config.storage.localDisk.baseDir, { recursive: true }),
		mkdir(config.database.embeddedPostgresDataDir, { recursive: true }),
		mkdir(config.database.backup.dir, { recursive: true }),
		mkdir(config.logging.logDir, { recursive: true }),
		mkdir(path.dirname(config.secrets.localEncrypted.keyFilePath), {
			recursive: true,
		}),
	]);
}
