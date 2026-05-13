import { describe, expect, it } from "bun:test";
import { parseArgs } from "../src/args";

describe("parseArgs cron", () => {
	it("rejects cron once command", () => {
		expect(() => parseArgs(["bun", "adhd-ai", "cron", "--once"])).toThrow(
			"Unknown command: cron",
		);
	});

	it("rejects cron once with a job", () => {
		expect(() =>
			parseArgs([
				"bun",
				"adhd-ai",
				"cron",
				"--once",
				"--job",
				"hourly-pr-review",
			]),
		).toThrow("Unknown command: cron");
	});
});
