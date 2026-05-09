import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

describe("package metadata for npm publish prep", () => {
	it("matches publish preparation contract", async () => {
		const packageJsonPath = path.join(process.cwd(), "package.json");
		const packageJsonRaw = await readFile(packageJsonPath, "utf8");
		const packageJson = JSON.parse(packageJsonRaw) as {
			name?: string;
			version?: string;
			private?: boolean;
			scripts?: Record<string, string>;
		};

		expect(packageJson.name).toBe("adhdai");
		expect(packageJson.version).toBe("0.0.1");
		expect(packageJson.private).toBe(false);
		expect(packageJson.scripts?.["publish:version"]).toBe(
			"bun run ./scripts/publish-version.ts",
		);
		expect(packageJson.scripts?.["prepare:publish"]).toContain("bun run check");
		expect(packageJson.scripts?.["prepare:publish"]).toContain(
			"bun run typecheck",
		);
		expect(packageJson.scripts?.["prepare:publish"]).toContain("bun test");
		expect(packageJson.scripts?.["prepare:publish"]).toContain("bun run build");
		expect(packageJson.scripts?.["prepare:publish"]).toContain(
			"npm pack --dry-run --ignore-scripts",
		);
	});
});
