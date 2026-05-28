import type { PromptAdapter } from "../prompts";
import { createDefaultSetupInstanceDraft } from "./instance-draft";
import type { SetupInstanceDraft } from "./types/setup.types";
import { parseRecipients, resolveUserPath } from "./wizard-helpers";

export async function collectInstanceDraft(
	prompts: PromptAdapter,
): Promise<SetupInstanceDraft> {
	const defaults = createDefaultSetupInstanceDraft();
	const customize = await prompts.confirm({
		message: "Customize advanced instance fields?",
		initialValue: false,
	});
	return customize ? promptInstanceDraft(prompts, defaults) : defaults;
}

async function promptInstanceDraft(
	prompts: PromptAdapter,
	defaults: SetupInstanceDraft,
): Promise<SetupInstanceDraft> {
	const backupEnabled = await prompts.confirm({
		message: "Enable database backups?",
		initialValue: defaults.database.backup.enabled,
	});
	return {
		database: {
			embeddedPostgresDataDir: await promptPath(
				prompts,
				"Embedded Postgres data directory",
				defaults.database.embeddedPostgresDataDir,
			),
			embeddedPostgresPort: await promptPort(
				prompts,
				"Embedded Postgres port",
				defaults.database.embeddedPostgresPort,
			),
			backup: {
				enabled: backupEnabled,
				intervalMinutes: await promptPositiveInteger(
					prompts,
					"Backup interval minutes",
					defaults.database.backup.intervalMinutes,
				),
				retentionDays: await promptPositiveInteger(
					prompts,
					"Backup retention days",
					defaults.database.backup.retentionDays,
				),
				dir: await promptPath(
					prompts,
					"Backup directory",
					defaults.database.backup.dir,
				),
			},
		},
		logging: {
			logDir: await promptPath(
				prompts,
				"Log directory",
				defaults.logging.logDir,
			),
		},
		server: {
			port: await promptPort(prompts, "Server port", defaults.server.port),
			allowedHostnames: parseRecipients(
				await prompts.text({
					message: "Allowed hostnames (comma separated)",
					defaultValue: defaults.server.allowedHostnames.join(","),
					initialValue: defaults.server.allowedHostnames.join(","),
				}),
			),
			serveUi: await prompts.confirm({
				message: "Serve web UI from server?",
				initialValue: defaults.server.serveUi,
			}),
		},
		auth: {
			disableSignUp: await prompts.confirm({
				message: "Disable sign-up?",
				initialValue: defaults.auth.disableSignUp,
			}),
		},
		telemetry: {
			enabled: await prompts.confirm({
				message: "Enable telemetry?",
				initialValue: defaults.telemetry.enabled,
			}),
		},
		storage: {
			localDiskBaseDir: await promptPath(
				prompts,
				"Storage directory",
				defaults.storage.localDiskBaseDir,
			),
			s3: {
				bucket: await promptText(
					prompts,
					"S3 bucket",
					defaults.storage.s3.bucket,
				),
				region: await promptText(
					prompts,
					"S3 region",
					defaults.storage.s3.region,
				),
				prefix: await promptText(
					prompts,
					"S3 prefix",
					defaults.storage.s3.prefix,
				),
				forcePathStyle: await prompts.confirm({
					message: "Use S3 path-style URLs?",
					initialValue: defaults.storage.s3.forcePathStyle,
				}),
			},
		},
		secrets: {
			strictMode: await prompts.confirm({
				message: "Strict secrets mode?",
				initialValue: defaults.secrets.strictMode,
			}),
			keyFilePath: await promptPath(
				prompts,
				"Secrets key file path",
				defaults.secrets.keyFilePath,
			),
		},
	};
}

async function promptPath(
	prompts: PromptAdapter,
	message: string,
	defaultValue: string,
): Promise<string> {
	return resolveUserPath(await promptText(prompts, message, defaultValue));
}

async function promptPort(
	prompts: PromptAdapter,
	message: string,
	defaultValue: number,
): Promise<number> {
	const value = await promptPositiveInteger(prompts, message, defaultValue);
	return value > 65_535 ? defaultValue : value;
}

async function promptPositiveInteger(
	prompts: PromptAdapter,
	message: string,
	defaultValue: number,
): Promise<number> {
	const value = Number.parseInt(
		await promptText(prompts, message, String(defaultValue)),
		10,
	);
	return Number.isInteger(value) && value > 0 ? value : defaultValue;
}

function promptText(
	prompts: PromptAdapter,
	message: string,
	defaultValue: string,
): Promise<string> {
	return prompts.text({ message, defaultValue, initialValue: defaultValue });
}
