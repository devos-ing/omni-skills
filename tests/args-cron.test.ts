import { describe, expect, it } from "bun:test";
import { parseArgs } from "../src/args";

describe("parseArgs cron once", () => {
	it("parses cron once command", () => {
		expect(parseArgs(["bun", "adhd-ai", "cron", "--once"])).toEqual({
			kind: "cron",
			jobId: undefined,
			once: true,
		});
	});

	it("parses cron once with a job", () => {
		expect(
			parseArgs([
				"bun",
				"adhd-ai",
				"cron",
				"--once",
				"--job",
				"hourly-pr-review",
			]),
		).toEqual({
			kind: "cron",
			jobId: "hourly-pr-review",
			once: true,
		});
	});
});
