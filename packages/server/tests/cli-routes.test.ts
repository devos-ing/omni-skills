import { describe, expect, it } from "bun:test";
import { createHandleRequest } from "../src/app";
import type { AppDeps } from "../src/app.types";

describe("CLI server routes", () => {
	it("returns command execution history", async () => {
		const history = [
			{
				requestedAt: "2026-05-12T00:00:00.000Z",
				finishedAt: "2026-05-12T00:00:01.000Z",
				request: { action: "onboard" as const },
				status: "succeeded" as const,
				command: "bun",
				args: ["run", "devos", "onboard"],
				exitCode: 0,
				stdout: "ok",
				stderr: "",
			},
		];
		const app = createHandleRequest(createDeps({ history }));

		const response = await app(
			new Request("http://localhost/api/cli/history", { method: "GET" }),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(history);
	});

	it("rejects unsupported methods for command history", async () => {
		const app = createHandleRequest(createDeps());

		const response = await app(
			new Request("http://localhost/api/cli/history", { method: "POST" }),
		);

		expect(response.status).toBe(405);
		expect(await response.json()).toEqual({ error: "Method Not Allowed" });
	});

	it("returns registered computers from the CLI executor", async () => {
		const app = createHandleRequest(
			createDeps({
				computers: [
					{
						id: "roys-macbook",
						name: "Roy's MacBook",
						hostname: "roys-macbook.local",
						platform: "darwin",
						arch: "arm64",
						cwd: "/repo",
						startedAt: "2026-05-24T00:00:00.000Z",
						workerId: "worker-1",
						status: "online",
						connectedAt: "2026-05-24T00:00:01.000Z",
						lastSeenAt: "2026-05-24T00:00:02.000Z",
					},
				],
			}),
		);

		const response = await app(
			new Request("http://localhost/api/computers", { method: "GET" }),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual([
			{
				id: "roys-macbook",
				name: "Roy's MacBook",
				hostname: "roys-macbook.local",
				platform: "darwin",
				arch: "arm64",
				cwd: "/repo",
				startedAt: "2026-05-24T00:00:00.000Z",
				workerId: "worker-1",
				status: "online",
				connectedAt: "2026-05-24T00:00:01.000Z",
				lastSeenAt: "2026-05-24T00:00:02.000Z",
			},
		]);
	});

	it("rejects unsupported methods for registered computers", async () => {
		const app = createHandleRequest(createDeps());

		const response = await app(
			new Request("http://localhost/api/computers", { method: "POST" }),
		);

		expect(response.status).toBe(405);
		expect(await response.json()).toEqual({ error: "Method Not Allowed" });
	});

	it("does not expose the retired HTTP dispatch endpoint", async () => {
		const app = createHandleRequest(createDeps());

		const response = await app(
			new Request("http://localhost/api/cli/dispatch", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "onboard" }),
			}),
		);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("Not Found");
	});
});

function createDeps(overrides?: {
	computers?: ReturnType<NonNullable<AppDeps["cliExecutor"]["listComputers"]>>;
	history?: AppDeps["cliExecutor"]["getHistory"] extends () => infer T
		? T
		: never;
}): AppDeps {
	return {
		cliExecutor: {
			execute: async (request) => ({
				status: "succeeded",
				request,
			}),
			executeStream: async (request) => ({
				status: "succeeded",
				request,
			}),
			getHistory: () => overrides?.history ?? [],
			listComputers: () => overrides?.computers ?? [],
		},
		notificationSender: {
			sendNotification: async () => {},
		},
		notificationService: {
			send: async () => ({ status: "ok" }),
		},
	};
}
