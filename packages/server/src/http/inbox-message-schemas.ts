import { z } from "zod";
import type {
	CreateInboxMessagePayload,
	InboxMessageScopeInput,
} from "./inbox-message-api.types";
import type { ParseResult } from "./zod-utils";
import { mapZodResult } from "./zod-utils";

const nonEmptyString = z.string().trim().min(1);
const optionalNullableString = z.string().trim().min(1).nullable().optional();
const optionalTimestamp = z
	.string()
	.refine((value) => !Number.isNaN(Date.parse(value)))
	.optional();
const optionalNullableMetadata = z
	.record(z.string(), z.unknown())
	.nullable()
	.optional();

const createInboxMessageSchema = z.object({
	workspaceId: nonEmptyString,
	userId: nonEmptyString,
	runId: nonEmptyString,
	source: nonEmptyString,
	kind: nonEmptyString,
	body: nonEmptyString,
	taskId: optionalNullableString,
	agentId: optionalNullableString,
	metadata: optionalNullableMetadata,
	createdAt: optionalTimestamp,
});

const inboxMessageScopeSchema = z.object({
	workspaceId: nonEmptyString,
	userId: nonEmptyString,
	runId: nonEmptyString,
});

export function parseCreateInboxMessagePayload(
	body: Record<string, unknown>,
): ParseResult<CreateInboxMessagePayload> {
	return mapZodResult(createInboxMessageSchema.safeParse(body), issueToError);
}

export function parseInboxMessageScopeInput(
	value: Record<string, unknown>,
): ParseResult<InboxMessageScopeInput> {
	return mapZodResult(inboxMessageScopeSchema.safeParse(value), issueToError);
}

function issueToError(issue: z.ZodIssue | undefined): string {
	const field = String(issue?.path[0] ?? "payload");
	if (field === "metadata") {
		return "metadata must be an object or null";
	}
	if (field === "createdAt") {
		return "createdAt must be a valid timestamp string";
	}
	if (field === "taskId" || field === "agentId") {
		return `${field} must be a non-empty string or null`;
	}
	return `${field} must be a non-empty string`;
}
