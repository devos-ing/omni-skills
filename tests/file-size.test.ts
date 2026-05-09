import { describe, expect, it } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const MAX_TS_LINES = 250;
const IGNORE_DIRS = new Set([
	".git",
	".piv-loop",
	"node_modules",
	"dist",
	"coverage",
]);
const KNOWN_OVERSIZED_TS_FILES = new Set([
	"src/core/config.ts",
	"src/core/setup.ts",
	"src/core/types.ts",
	"src/core/workflow.ts",
	"src/services/codex-adapter.ts",
	"src/services/cron.ts",
	"src/services/github.ts",
	"src/services/linear.ts",
	"src/skills/catalog.ts",
	"tests/config.test.ts",
	"tests/cron.test.ts",
	"tests/github.test.ts",
	"tests/linear.test.ts",
	"tests/setup.test.ts",
	"tests/workflow.test.ts",
]);

async function collectTsFiles(root: string, dir = ""): Promise<string[]> {
	const absolute = path.join(root, dir);
	const entries = await readdir(absolute, { withFileTypes: true });
	const collected: string[] = [];

	for (const entry of entries) {
		if (IGNORE_DIRS.has(entry.name)) {
			continue;
		}
		const relativePath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			const nested = await collectTsFiles(root, relativePath);
			collected.push(...nested);
			continue;
		}
		if (entry.isFile() && relativePath.endsWith(".ts")) {
			collected.push(relativePath);
		}
	}

	return collected;
}

function countLines(text: string): number {
	if (!text) {
		return 0;
	}
	return text.endsWith("\n")
		? text.split("\n").length - 1
		: text.split("\n").length;
}

describe("TypeScript file size limit", () => {
	it("blocks new TypeScript files from exceeding 250 lines", async () => {
		const root = path.resolve(import.meta.dir, "..");
		const files = await collectTsFiles(root);
		const unexpectedViolations: string[] = [];

		for (const file of files) {
			const contents = await readFile(path.join(root, file), "utf8");
			const lineCount = countLines(contents);
			const isKnownOversized = KNOWN_OVERSIZED_TS_FILES.has(file);
			if (lineCount > MAX_TS_LINES && !isKnownOversized) {
				unexpectedViolations.push(`${file}: ${lineCount}`);
			}
		}

		expect(unexpectedViolations).toEqual([]);
	});
});
