import { describe, expect, it } from "bun:test";
import { waitForDaemonHttpReady } from "../src/features/daemon";

describe("waitForDaemonHttpReady", () => {
	it("retries until a daemon HTTP service is healthy", async () => {
		let attempts = 0;

		await waitForDaemonHttpReady("http://127.0.0.1:3001/health", {
			fetch: async () => {
				attempts += 1;
				return { ok: attempts === 2 };
			},
			sleep: async () => {},
		});

		expect(attempts).toBe(2);
	});

	it("stops readiness polling when daemon startup has already finished", async () => {
		let attempts = 0;
		let stopped = false;

		await waitForDaemonHttpReady("http://127.0.0.1:3001/health", {
			fetch: async () => {
				attempts += 1;
				return { ok: false };
			},
			shouldStop: () => stopped,
			sleep: async () => {
				stopped = true;
			},
		});

		expect(attempts).toBe(1);
	});
});
