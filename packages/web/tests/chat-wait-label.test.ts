import { describe, expect, it } from "bun:test";
import { formatWaitDurationLabel } from "../src/components/chat-room/chat-wait-label";

describe("chat wait label", () => {
	it("formats elapsed loading time as seconds", () => {
		expect(
			formatWaitDurationLabel(
				"2026-05-16T00:00:00.000Z",
				new Date("2026-05-16T00:00:01.500Z").getTime(),
			),
		).toBe("Waiting for 1 second");
		expect(
			formatWaitDurationLabel(
				"2026-05-16T00:00:00.000Z",
				new Date("2026-05-16T00:00:06.000Z").getTime(),
			),
		).toBe("Waiting for 6 seconds");
	});
});
