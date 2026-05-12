import { afterEach, describe, expect, it } from "bun:test";
import type { RunState } from "../src/features/types";
import {
	buildHumanReviewRequiredEmailPayload,
	buildTaskOutcomeEmailPayload,
	sendHumanReviewRequiredEmail,
	sendTaskOutcomeEmail,
} from "../src/integrations/notifications";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("buildTaskOutcomeEmailPayload", () => {
	it("builds done payload with summary and PR URL", () => {
		const payload = buildTaskOutcomeEmailPayload(
			"ops@example.com",
			["dev@example.com"],
			createRunState(),
			"done",
		);
		expect(payload.subject).toContain("DONE");
		expect(payload.text).toContain("Summary: Tests green.");
		expect(payload.text).toContain("PR: https://example.com/pr/1");
	});

	it("builds blocked payload with error message", () => {
		const payload = buildTaskOutcomeEmailPayload(
			"ops@example.com",
			["dev@example.com"],
			createRunState(),
			"blocked",
			"codex session failed",
		);
		expect(payload.subject).toContain("BLOCKED");
		expect(payload.text).toContain("Error: codex session failed");
	});
});

describe("buildHumanReviewRequiredEmailPayload", () => {
	it("includes PR URL and complexity score", () => {
		const payload = buildHumanReviewRequiredEmailPayload(
			"ops@example.com",
			["dev@example.com"],
			createRunState(),
			8,
			"Complexity score requires human review.",
		);
		expect(payload.subject).toContain("HUMAN REVIEW REQUIRED");
		expect(payload.text).toContain("Complexity Score: 8/10");
		expect(payload.text).toContain("PR: https://example.com/pr/1");
		expect(payload.text).toContain(
			"Reason: Complexity score requires human review.",
		);
	});
});

describe("sendTaskOutcomeEmail", () => {
	it("calls Resend API with expected payload", async () => {
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			requests.push({ url: String(input), init });
			return new Response(JSON.stringify({ id: "email_123" }), {
				status: 200,
			});
		}) as unknown as typeof fetch;

		await sendTaskOutcomeEmail(
			{
				enabled: true,
				resendApiKey: "re_test",
				from: "ops@example.com",
				to: ["dev@example.com"],
			},
			createRunState(),
			"done",
		);

		expect(requests).toHaveLength(1);
		expect(requests[0]?.url).toBe("https://api.resend.com/emails");
		expect(requests[0]?.init?.method).toBe("POST");
		const rawBody = requests[0]?.init?.body;
		const body =
			typeof rawBody === "string"
				? (JSON.parse(rawBody) as Record<string, unknown>)
				: {};
		expect(body.from).toBe("ops@example.com");
		expect(body.to).toEqual(["dev@example.com"]);
		expect(body.subject).toContain("ENG-1");
	});

	it("throws when Resend request fails", async () => {
		globalThis.fetch = (async () =>
			new Response("bad request", { status: 400 })) as unknown as typeof fetch;

		await expect(
			sendTaskOutcomeEmail(
				{
					enabled: true,
					resendApiKey: "re_test",
					from: "ops@example.com",
					to: ["dev@example.com"],
				},
				createRunState(),
				"done",
			),
		).rejects.toThrow("Resend send failed with status 400.");
	});
});

describe("sendHumanReviewRequiredEmail", () => {
	it("calls Resend API with human review payload", async () => {
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			requests.push({ url: String(input), init });
			return new Response(JSON.stringify({ id: "email_456" }), {
				status: 200,
			});
		}) as unknown as typeof fetch;

		await sendHumanReviewRequiredEmail(
			{
				enabled: true,
				resendApiKey: "re_test",
				from: "ops@example.com",
				to: ["dev@example.com"],
			},
			createRunState(),
			{
				complexityScore: 7,
				reason: "High complexity",
			},
		);

		expect(requests).toHaveLength(1);
		const rawBody = requests[0]?.init?.body;
		const body =
			typeof rawBody === "string"
				? (JSON.parse(rawBody) as Record<string, unknown>)
				: {};
		expect(body.subject).toBe("[ADHD.ai][Default] ENG-1 HUMAN REVIEW REQUIRED");
		expect(typeof body.text).toBe("string");
		expect(String(body.text)).toContain("Complexity Score: 7/10");
	});
});

function createRunState(): RunState {
	return {
		projectId: "default",
		projectName: "Default",
		workspacePath: "/tmp/work",
		repository: {
			owner: "acme",
			name: "repo",
			baseBranch: "main",
		},
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
