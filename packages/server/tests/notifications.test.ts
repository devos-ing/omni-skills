import { describe, expect, it } from "bun:test";
import type { RunState } from "adhdai/features/types";
import { createHandleRequest } from "../src/app";
import {
	createNotificationConfigFromEnv,
	createNotificationService,
} from "../src/notifications/notifications-service";
import type {
	NotificationEmailPayload,
	NotificationRequest,
	NotificationSendResult,
	ResendClient,
} from "../src/notifications/notifications.types";

describe("notification service", () => {
	it("builds and sends task outcome payload", async () => {
		const payloads: NotificationEmailPayload[] = [];
		const service = createNotificationService({
			config: {
				resendApiKey: "re_test",
				from: "ops@example.com",
				to: ["dev@example.com"],
			},
			resendClient: {
				sendEmail: async (payload) => {
					payloads.push(payload);
				},
			},
		});

		const result = await service.send({
			type: "task_outcome",
			state: createRunState(),
			outcome: "done",
		});

		expect(result).toEqual({ status: "ok" });
		expect(payloads).toHaveLength(1);
		expect(payloads[0]?.from).toBe("ops@example.com");
		expect(payloads[0]?.to).toEqual(["dev@example.com"]);
		expect(payloads[0]?.subject).toContain("ENG-1 DONE");
		expect(payloads[0]?.text).toContain("Summary: Tests green.");
	});

	it("builds and sends human review payload", async () => {
		const payloads: NotificationEmailPayload[] = [];
		const service = createNotificationService({
			config: {
				resendApiKey: "re_test",
				from: "ops@example.com",
				to: ["dev@example.com"],
			},
			resendClient: {
				sendEmail: async (payload) => {
					payloads.push(payload);
				},
			},
		});

		const result = await service.send({
			type: "human_review_required",
			state: createRunState(),
			complexityScore: 8,
			reason: "Manual validation required",
		});

		expect(result).toEqual({ status: "ok" });
		expect(payloads).toHaveLength(1);
		expect(payloads[0]?.subject).toContain("HUMAN REVIEW REQUIRED");
		expect(payloads[0]?.text).toContain("Complexity Score: 8/10");
		expect(payloads[0]?.text).toContain("Reason: Manual validation required");
	});

	it("returns config error when required env is missing", async () => {
		const service = createNotificationService({
			config: createNotificationConfigFromEnv({
				RESEND_API_KEY: undefined,
				RESEND_FROM: undefined,
				RESEND_TO: "",
			}),
			resendClient: { sendEmail: async () => undefined },
		});

		const result = await service.send({
			type: "task_outcome",
			state: createRunState(),
			outcome: "done",
		});

		expect(result.status).toBe("config_error");
	});

	it("returns send error when resend fails", async () => {
		const service = createNotificationService({
			config: {
				resendApiKey: "re_test",
				from: "ops@example.com",
				to: ["dev@example.com"],
			},
			resendClient: {
				sendEmail: async () => {
					throw new Error("Resend blew up");
				},
			},
		});

		const result = await service.send({
			type: "task_outcome",
			state: createRunState(),
			outcome: "done",
		});

		expect(result).toEqual({ status: "send_error", error: "Resend blew up" });
	});
});

describe("notification route", () => {
	it("returns 405 for unsupported methods", async () => {
		const app = createHandleRequest(createDeps());
		const response = await app(
			new Request("http://localhost/api/notifications/email", {
				method: "GET",
			}),
		);
		expect(response.status).toBe(405);
	});

	it("returns 400 for malformed json", async () => {
		const app = createHandleRequest(createDeps());
		const response = await app(
			new Request("http://localhost/api/notifications/email", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{not-json}",
			}),
		);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Malformed JSON body" });
	});

	it("returns 400 for invalid body", async () => {
		const app = createHandleRequest(createDeps());
		const response = await app(
			new Request("http://localhost/api/notifications/email", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ type: "task_outcome", outcome: "done" }),
			}),
		);
		expect(response.status).toBe(400);
	});

	it("returns 503 for config errors", async () => {
		const app = createHandleRequest(
			createDeps({
				send: async () => ({
					status: "config_error",
					error: "RESEND_API_KEY is required",
				}),
			}),
		);
		const response = await app(validTaskOutcomeRequest());
		expect(response.status).toBe(503);
	});

	it("returns 502 for resend send failures", async () => {
		const app = createHandleRequest(
			createDeps({
				send: async () => ({ status: "send_error", error: "Resend failed" }),
			}),
		);
		const response = await app(validTaskOutcomeRequest());
		expect(response.status).toBe(502);
	});

	it("returns 200 for success", async () => {
		const app = createHandleRequest(createDeps());
		const response = await app(validTaskOutcomeRequest());
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "sent" });
	});
});

function createDeps(overrides?: {
	send?: (request: NotificationRequest) => Promise<NotificationSendResult>;
	resendClient?: ResendClient;
}) {
	return {
		cliExecutor: {
			execute: async () => ({
				status: "succeeded" as const,
				request: { action: "none" as const },
			}),
			getHistory: () => [],
		},
		notificationService: {
			send:
				overrides?.send ??
				(async () => {
					return { status: "ok" as const };
				}),
		},
	};
}

function validTaskOutcomeRequest(): Request {
	return new Request("http://localhost/api/notifications/email", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			type: "task_outcome",
			outcome: "done",
			state: createRunState(),
		}),
	});
}

function createRunState(): RunState {
	return {
		projectId: "default",
		projectName: "Default",
		workspacePath: "/tmp/work",
		repository: { owner: "acme", name: "repo", baseBranch: "main" },
		issue: {
			id: "lin_123",
			key: "ENG-1",
			title: "Improve logging",
			url: "https://linear.app/acme/issue/ENG-1/improve-logging",
		},
		stage: "done",
		bugs: [],
		testingSummary: "Tests green.",
		pullRequest: {
			branch: "codex/eng-1",
			title: "ENG-1",
			url: "https://example.com/pr/1",
		},
		startedAt: "2026-05-07T12:00:00.000Z",
		updatedAt: "2026-05-07T12:10:00.000Z",
	};
}
