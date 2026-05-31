import { z } from "zod";
import type {
	CreateProjectPayload,
	CreateTaskPayload,
	UpdateProjectPayload,
	UpdateTaskPayload,
} from "./types/project-task-api.types";
import type { ParseResult } from "./zod-utils";
import { mapZodResult } from "./zod-utils";

const nonEmptyString = z.string().trim().min(1);
const taskContentString = z.string().trim();
const optionalNullableString = z.string().nullable().optional();
const optionalTimestamp = z
	.string()
	.refine((value) => !Number.isNaN(Date.parse(value)))
	.nullable()
	.optional();

const createProjectSchema = z.object({
	boardId: nonEmptyString,
	name: nonEmptyString,
	ownerId: nonEmptyString,
	emoji: optionalNullableString,
	externalProjectId: optionalNullableString,
	description: optionalNullableString,
	repoOwner: optionalNullableString,
	repoName: optionalNullableString,
	baseBranch: optionalNullableString,
	localFolder: optionalNullableString,
	lead: optionalNullableString,
	category: optionalNullableString,
	priority: z.number().int().nullable().optional(),
});

const updateProjectSchema = createProjectSchema.partial();

const createTaskSchema = z.object({
	taskKey: nonEmptyString.optional(),
	projectId: optionalNullableString,
	title: nonEmptyString,
	content: taskContentString.optional().default(""),
	priority: z.number().int(),
	status: nonEmptyString,
	creatorId: nonEmptyString,
	assigneeId: optionalNullableString,
	dueDate: optionalTimestamp,
	linkedPr: optionalNullableString,
});

const updateTaskSchema = z.object({
	taskKey: nonEmptyString.optional(),
	projectId: optionalNullableString,
	title: nonEmptyString.optional(),
	content: taskContentString.optional(),
	priority: z.number().int().optional(),
	status: nonEmptyString.optional(),
	creatorId: nonEmptyString.optional(),
	assigneeId: optionalNullableString,
	dueDate: optionalTimestamp,
	linkedPr: optionalNullableString,
});

export function parseCreateProjectPayload(
	body: Record<string, unknown>,
): ParseResult<CreateProjectPayload> {
	return mapZodResult(createProjectSchema.safeParse(body), issueToError);
}

export function parseUpdateProjectPayload(
	body: Record<string, unknown>,
): ParseResult<UpdateProjectPayload> {
	return mapZodResult(updateProjectSchema.safeParse(body), issueToError);
}

export function parseCreateTaskPayload(
	body: Record<string, unknown>,
): ParseResult<CreateTaskPayload> {
	return mapZodResult(createTaskSchema.safeParse(body), issueToError);
}

export function parseUpdateTaskPayload(
	body: Record<string, unknown>,
): ParseResult<UpdateTaskPayload> {
	return mapZodResult(updateTaskSchema.safeParse(body), issueToError);
}

function issueToError(issue: z.ZodIssue | undefined): string {
	const field = String(issue?.path[0] ?? "payload");
	if (field === "priority") {
		return "priority must be an integer";
	}
	if (field === "dueDate") {
		return "dueDate must be a valid timestamp string or null";
	}
	if (field === "content") {
		return "content must be a string";
	}
	return `${field} must be a non-empty string`;
}

export function isNonEmptyObject(value: object): boolean {
	return Object.keys(value).length > 0;
}
