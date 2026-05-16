import { describe, expect, it } from "bun:test";
import {
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { recoverServerDatabase } from "../../../scripts/recover-server-db";

describe("recover server database script", () => {
	it("dry-runs by validating a copied database directory", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-db-recover-"));
		const sourcePath = path.join(tempDir, "server-db");
		await createMarkerDatabase(sourcePath, "dry-run");
		const validationPaths: string[] = [];

		const result = await recoverServerDatabase({
			dbPath: sourcePath,
			validateDatabase: async (databasePath) => {
				validationPaths.push(databasePath);
				expect(databasePath).not.toBe(sourcePath);
				expect(await readMarker(databasePath)).toBe("dry-run");
			},
		});

		expect(result).toEqual({ applied: false, sourcePath });
		expect(validationPaths).toHaveLength(1);
		expect(await readMarker(sourcePath)).toBe("dry-run");
		await rm(tempDir, { recursive: true, force: true });
	});

	it("applies by retaining a timestamped backup", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-db-recover-"));
		const sourcePath = path.join(tempDir, "server-db");
		await createMarkerDatabase(sourcePath, "apply");

		const result = await recoverServerDatabase({
			apply: true,
			dbPath: sourcePath,
			now: new Date("2026-05-15T16:24:31.765Z"),
			validateDatabase: async (databasePath) => {
				expect(await readMarker(databasePath)).toBe("apply");
			},
		});

		expect(result.applied).toBe(true);
		expect(result.backupPath).toBe(
			path.join(tempDir, "server-db.backup-20260515T162431765Z"),
		);
		expect(await exists(sourcePath)).toBe(true);
		expect(await exists(result.backupPath ?? "")).toBe(true);
		expect(await readMarker(sourcePath)).toBe("apply");
		expect(await readMarker(result.backupPath ?? "")).toBe("apply");
		await rm(tempDir, { recursive: true, force: true });
	});

	it("does not create a backup when copied validation fails", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-db-recover-"));
		const sourcePath = path.join(tempDir, "server-db");
		await createMarkerDatabase(sourcePath, "bad");

		await expect(
			recoverServerDatabase({
				apply: true,
				dbPath: sourcePath,
				now: new Date("2026-05-15T16:24:31.765Z"),
				validateDatabase: async () => {
					throw new Error("validation failed");
				},
			}),
		).rejects.toThrow(
			`Copied server database validation failed for ${sourcePath} using temporary copy`,
		);

		expect(await readMarker(sourcePath)).toBe("bad");
		expect(await readdir(tempDir)).toEqual(["server-db"]);
		await rm(tempDir, { recursive: true, force: true });
	});
});

async function createMarkerDatabase(
	databasePath: string,
	value: string,
): Promise<void> {
	await mkdir(databasePath, { recursive: true });
	await writeFile(path.join(databasePath, "marker.txt"), value);
}

async function readMarker(databasePath: string): Promise<string> {
	return readFile(path.join(databasePath, "marker.txt"), "utf8");
}

async function exists(filePath: string): Promise<boolean> {
	try {
		await stat(filePath);
		return true;
	} catch {
		return false;
	}
}
