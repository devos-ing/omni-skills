import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../../..");

describe("Bun test discovery config", () => {
	test("keeps raw bun test scoped to package tests", () => {
		const bunfig = readFileSync(join(repoRoot, "bunfig.toml"), "utf8");

		expect(bunfig).toContain("[test]");
		expect(bunfig).toContain('root = "./packages"');
	});

	test("keeps e2e available through the explicit lane", () => {
		const packageJson = JSON.parse(
			readFileSync(join(repoRoot, "package.json"), "utf8"),
		) as { scripts?: Record<string, string> };
		const testLaneScript = readFileSync(
			join(repoRoot, "scripts/test-lane.ts"),
			"utf8",
		);

		expect(packageJson.scripts?.test).toBe(
			"bun run ./scripts/test-lane.ts default",
		);
		expect(packageJson.scripts?.["test:e2e"]).toBe(
			"bun run ./scripts/test-lane.ts e2e",
		);
		expect(testLaneScript).toContain("cwd: E2E_TEST_ROOT");
	});
});
