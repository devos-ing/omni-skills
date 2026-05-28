import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { instanceConfigPath } from "../src/features/config";
import { collectSetupDraft, writeSetupFiles } from "../src/features/setup";
import {
	baseSetupDraft,
	customInstanceDraft,
	promptAdapter,
} from "./setup-instance-test-helpers";

describe("setup instance prompts", () => {
	let previousHome: string | undefined;
	let testHomeDir: string | undefined;

	beforeEach(async () => {
		previousHome = process.env.HOME;
		testHomeDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-setup-instance-home-"),
		);
		process.env.HOME = testHomeDir;
	});

	afterEach(async () => {
		process.env.HOME = previousHome;
		if (testHomeDir) {
			await rm(testHomeDir, { recursive: true, force: true });
		}
		previousHome = undefined;
		testHomeDir = undefined;
	});

	it("collects default instance fields when advanced prompts are skipped", async () => {
		const draft = await collectSetupDraft("/tmp/demo", {
			prompts: promptAdapter({
				text: { "Workspace name": "Demo Workspace" },
				confirm: { "Customize advanced instance fields?": false },
			}),
		});

		expect(draft.instance.server.port).toBe(3100);
		expect(draft.instance.server.serveUi).toBe(true);
		expect(draft.instance.database.embeddedPostgresPort).toBe(54329);
		expect(draft.instance.database.backup.enabled).toBe(true);
		expect(draft.instance.auth.disableSignUp).toBe(false);
		expect(draft.instance.telemetry.enabled).toBe(true);
		expect(draft.instance.secrets.strictMode).toBe(false);
	});

	it("maps advanced instance prompt answers into the setup draft", async () => {
		const draft = await collectSetupDraft("/tmp/demo", {
			prompts: promptAdapter({
				text: {
					"Workspace name": "Demo Workspace",
					"Server port": "4200",
					"Allowed hostnames (comma separated)": "devos.local, ops.local",
					"Embedded Postgres data directory": "/var/devos/postgres",
					"Embedded Postgres port": "55432",
					"Backup interval minutes": "15",
					"Backup retention days": "7",
					"Backup directory": "/var/devos/backups",
					"Storage directory": "/var/devos/storage",
					"S3 bucket": "devos-artifacts",
					"S3 region": "us-west-2",
					"S3 prefix": "prod/",
					"Log directory": "/var/log/devos",
					"Secrets key file path": "/var/devos/secrets/master.key",
				},
				confirm: {
					"Customize advanced instance fields?": true,
					"Serve web UI from server?": false,
					"Enable database backups?": true,
					"Use S3 path-style URLs?": true,
					"Strict secrets mode?": true,
					"Disable sign-up?": true,
					"Enable telemetry?": false,
				},
			}),
		});

		expect(draft.instance).toMatchObject({
			database: {
				embeddedPostgresDataDir: "/var/devos/postgres",
				embeddedPostgresPort: 55432,
				backup: {
					enabled: true,
					intervalMinutes: 15,
					retentionDays: 7,
					dir: "/var/devos/backups",
				},
			},
			logging: { logDir: "/var/log/devos" },
			server: {
				port: 4200,
				allowedHostnames: ["devos.local", "ops.local"],
				serveUi: false,
			},
			auth: { disableSignUp: true },
			telemetry: { enabled: false },
			storage: {
				localDiskBaseDir: "/var/devos/storage",
				s3: {
					bucket: "devos-artifacts",
					region: "us-west-2",
					prefix: "prod/",
					forcePathStyle: true,
				},
			},
			secrets: {
				strictMode: true,
				keyFilePath: "/var/devos/secrets/master.key",
			},
		});
	});

	it("writes customized instance fields to the instance config", async () => {
		const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-setup-"));
		const instance = customInstanceDraft(tempDir);
		try {
			await writeSetupFiles(tempDir, {
				...baseSetupDraft(),
				instance,
			});

			const config = JSON.parse(await readFile(instanceConfigPath(), "utf8"));
			expect(config.database).toMatchObject({
				embeddedPostgresDataDir: instance.database.embeddedPostgresDataDir,
				embeddedPostgresPort: 55432,
				backup: {
					enabled: false,
					intervalMinutes: 30,
					retentionDays: 14,
					dir: instance.database.backup.dir,
				},
			});
			expect(config.server).toMatchObject({
				port: 4200,
				allowedHostnames: ["devos.local"],
				serveUi: false,
			});
			expect(config.storage).toMatchObject({
				localDisk: { baseDir: instance.storage.localDiskBaseDir },
				s3: {
					bucket: "devos-artifacts",
					region: "us-west-2",
					prefix: "prod/",
					forcePathStyle: true,
				},
			});
			expect(config.logging.logDir).toBe(instance.logging.logDir);
			expect(config.auth.disableSignUp).toBe(true);
			expect(config.telemetry.enabled).toBe(false);
			expect(config.secrets).toMatchObject({
				strictMode: true,
				localEncrypted: { keyFilePath: instance.secrets.keyFilePath },
			});
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
