import { describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

describe("CLI server DB boundary", () => {
	it("does not import devos-server/db from production CLI source", async () => {
		const files = await listTypeScriptFiles(path.resolve(import.meta.dir, "../src"));
		const offenders: string[] = [];
		for (const file of files) {
			const source = await readFile(file, "utf8");
			if (source.includes('"devos-server/db"')) {
				offenders.push(path.relative(process.cwd(), file));
			}
		}
		expect(offenders).toEqual([]);
	});
});

async function listTypeScriptFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(root, entry.name);
			if (entry.isDirectory()) {
				return listTypeScriptFiles(entryPath);
			}
			return entry.name.endsWith(".ts") ? [entryPath] : [];
		}),
	);
	return nested.flat();
}
