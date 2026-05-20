import { describe, expect, it } from "bun:test";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
	PGLITE_RUNTIME_ASSETS,
	resolvePglitePackageEntry,
	resolvePgliteRuntimeAssets,
} from "../scripts/build";

describe("CLI build script", () => {
	it("resolves PGlite from the server database boundary", async () => {
		const calls: Array<{ specifier: string; parent: string }> = [];
		const serverDbEntry = "/workspace/packages/server/src/db/index.ts";
		const pgliteEntry = "/workspace/node_modules/pglite/dist/index.js";

		const entry = await resolvePglitePackageEntry(async (specifier, parent) => {
			calls.push({ specifier, parent });
			if (specifier === "devos-server/db") {
				return serverDbEntry;
			}
			if (specifier === "@electric-sql/pglite") {
				return pgliteEntry;
			}
			throw new Error(`Unexpected specifier: ${specifier}`);
		});

		expect(entry).toBe(pgliteEntry);
		expect(calls).toEqual([
			{
				specifier: "devos-server/db",
				parent: path.resolve(import.meta.dir, ".."),
			},
			{ specifier: "@electric-sql/pglite", parent: serverDbEntry },
		]);
	});

	it("resolves PGlite runtime assets required by bundled devos", async () => {
		const assets = await resolvePgliteRuntimeAssets();

		expect(assets.map((asset) => asset.fileName).sort()).toEqual(
			[...PGLITE_RUNTIME_ASSETS].sort(),
		);
		for (const asset of assets) {
			expect(path.basename(asset.path)).toBe(asset.fileName);
			expect((await stat(asset.path)).isFile()).toBe(true);
		}
	});
});
