import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { READ_ONLY_SERVER_PATHS } from "../src/routes";

function extractOpenApiPathKeys(openApiDocument: string): Set<string> {
	const pathsSection = openApiDocument.match(
		/(^|\n)paths:\n([\s\S]*?)(\n[a-zA-Z0-9_-]+:|\n?$)/,
	);
	if (!pathsSection?.[2]) {
		return new Set();
	}

	const keys = new Set<string>();
	for (const line of pathsSection[2].split("\n")) {
		const match = line.match(/^ {2}(\/[^:]+):\s*$/);
		if (match?.[1]) {
			keys.add(match[1]);
		}
	}
	return keys;
}

describe("openapi contract", () => {
	it("includes all implemented read-only server routes", () => {
		const root = path.resolve(__dirname, "../..", "..");
		const openApiPath = path.join(root, "openapi.yaml");
		const openApiText = readFileSync(openApiPath, "utf-8");
		const documentedPaths = extractOpenApiPathKeys(openApiText);

		expect(documentedPaths.size).toBeGreaterThan(0);
		for (const implementedPath of READ_ONLY_SERVER_PATHS) {
			expect(documentedPaths.has(implementedPath)).toBeTrue();
		}
	});
});
