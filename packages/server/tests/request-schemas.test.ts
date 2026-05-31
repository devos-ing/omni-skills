import { describe, expect, it } from "bun:test";
import {
	parseCreateInboxMessagePayload,
	parseInboxMessageScopeInput,
} from "../src/http/inbox-message-schemas";
import {
	parseCreateProjectPayload,
	parseCreateTaskPayload,
	parseUpdateProjectPayload,
} from "../src/http/project-task-schemas";
import { parseNotificationServerBody } from "../src/notifications/notification-server-request";
import {
	validateCreatePayload,
	validateUpdatePayload,
} from "../src/routes/entity-crud-validators";

describe("request schemas", () => {
	it("accepts valid project and task payloads", () => {
		expect(
			parseCreateProjectPayload({
				boardId: "board-1",
				name: "Website",
				ownerId: "user-1",
				emoji: "🧭",
				description: null,
				repoOwner: "octo",
				repoName: "repo",
				baseBranch: "main",
				localFolder: "/tmp/repo",
				lead: "Roy",
				category: "platform",
				priority: 1,
			}).ok,
		).toBeTrue();
		expect(
			parseCreateTaskPayload({
				projectId: "project-1",
				title: "Ship it",
				content: "Finish implementation",
				priority: 1,
				status: "todo",
				creatorId: "user-1",
				assigneeId: "user-2",
			}).ok,
		).toBeTrue();
		expect(
			parseCreateTaskPayload({
				projectId: "project-1",
				title: "Ship it",
				content: "",
				priority: 1,
				status: "todo",
				creatorId: "user-1",
			}).ok,
		).toBeTrue();
		expect(
			parseCreateTaskPayload({
				projectId: "project-1",
				title: "Ship it",
				priority: 1,
				status: "todo",
				creatorId: "user-1",
			}),
		).toMatchObject({ ok: true, value: { content: "" } });
	});

	it("returns route-compatible project and task errors", () => {
		expect(parseUpdateProjectPayload({ name: "" })).toEqual({
			ok: false,
			error: "name must be a non-empty string",
		});
		expect(parseCreateTaskPayload({ priority: 1.5 })).toEqual({
			ok: false,
			error: "title must be a non-empty string",
		});
	});

	it("preserves entity CRUD error text", () => {
		expect(
			validateCreatePayload({ id: "a" }, ["id", "createdAt"] as const),
		).toEqual({
			ok: false,
			error: "Malformed request: missing required field 'createdAt'",
		});
		expect(validateUpdatePayload({ id: "nope" }, ["name"] as const)).toEqual({
			ok: false,
			error: "Malformed request: unknown field 'id'",
		});
	});

	it("validates notification server payloads", () => {
		expect(
			parseNotificationServerBody({
				type: "task-outcome",
				payload: {
					from: "ops@example.com",
					to: ["dev@example.com"],
					subject: "Done",
					text: "All set",
				},
			}).status,
		).toBe("ok");
		expect(parseNotificationServerBody({ type: "what" })).toEqual({
			status: "error",
			error:
				"Malformed notification request: type must be 'task-outcome' or 'human-review-required'",
		});
	});

	it("validates inbox message payload and scope contracts", () => {
		expect(
			parseCreateInboxMessagePayload({
				workspaceId: "workspace-1",
				userId: "user-1",
				runId: "run-1",
				source: "agent_workflow_event",
				kind: "agent_message",
				body: "Agent started implementing",
				metadata: { step: "implement" },
			}).ok,
		).toBeTrue();
		expect(
			parseCreateInboxMessagePayload({ workspaceId: "workspace-1" }),
		).toEqual({
			ok: false,
			error: "userId must be a non-empty string",
		});
		expect(
			parseInboxMessageScopeInput({
				workspaceId: "workspace-1",
				userId: "user-1",
				runId: "run-1",
			}).ok,
		).toBeTrue();
		expect(
			parseInboxMessageScopeInput({
				workspaceId: "workspace-1",
				userId: "",
				runId: "run-1",
			}),
		).toEqual({
			ok: false,
			error: "userId must be a non-empty string",
		});
	});
});
