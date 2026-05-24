import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { instanceConfigPath, saveSqliteEnv } from "../config";
import { ENV_FILE } from "./constants";
import {
	buildDatabaseEnvUpdates,
	buildEnvUpdates,
	mergeEnvFile,
} from "./env-file";
import {
	createInstanceConfig,
	loadInstanceConfig,
	renderInstanceConfigDocument,
} from "./instance-config";
import type { OnboardInstanceConfig } from "./instance-config.types";
import type { SetupDraft } from "./setup.types";
import { readExistingFile } from "./wizard-helpers";

export async function writeSetupFiles(
	cwd: string,
	draft: SetupDraft,
): Promise<void> {
	const envPath = path.join(cwd, ENV_FILE);
	const targetInstanceConfigPath = instanceConfigPath();
	const existingEnv = await readExistingFile(envPath);
	const jwtSecret = randomBytes(32).toString("base64url");
	const envUpdates = { ...buildEnvUpdates(draft), JWT_SECRET: jwtSecret };
	const databaseEnvUpdates = {
		...buildDatabaseEnvUpdates(draft),
		...envUpdates,
	};
	await writeFile(envPath, mergeEnvFile(existingEnv, envUpdates));
	await saveSqliteEnv(cwd, databaseEnvUpdates);
	const existingInstanceConfig = await loadInstanceConfig(cwd);
	const instanceConfig = createInstanceConfig(cwd, new Date().toISOString());
	if (existingInstanceConfig.ok && existingInstanceConfig.config.plugins) {
		instanceConfig.plugins = existingInstanceConfig.config.plugins;
	}
	await mkdir(path.dirname(targetInstanceConfigPath), { recursive: true });
	await createLocalInstanceDirectories(instanceConfig);
	await writeFile(
		targetInstanceConfigPath,
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
