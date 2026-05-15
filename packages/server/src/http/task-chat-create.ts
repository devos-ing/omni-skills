import { z } from "zod";
import type { CliExecutor } from "../app.types";
import type { ServerDatabase } from "../db";
import type { BoardTaskRow } from "../db/board-tasks.types";
import {
	badRequest,
	methodNotAllowed,
	parseObjectJsonBody,
} from "./http-utils";
import { jsonSuccess } from "./response";
import type {
	TaskChatCreateIntakeResult,
	TaskChatCreateRequest,
	TaskChatCreateResponse,
} from "./task-chat-create.types";

const answerSchema = z.object({
	question: z.string().trim().min(1),
	answer: z.string().trim().min(1),
});

const requestSchema = z.object({
	request: z.string().trim().min(1),
	projectId: z.string().trim().min(1).optional(),
	answers: z.array(answerSchema).optional(),
});

export async function handleTaskChatCreateRoute(
	request: Request,
	_db: ServerDatabase["db"],
	cliExecutor: CliExecutor,
): Promise<Response> {
	if (request.method !== "POST") {
		return methodNotAllowed();
	}
	const parsedBody = await parseObjectJsonBody(request);
	if (!parsedBody.ok) {
		return badRequest(parsedBody.error);
	}
	const parsed = requestSchema.safeParse(parsedBody.value);
	if (!parsed.success) {
		return badRequest("Invalid chat task create payload");
	}
	const result = await composeTaskChatCreate(parsed.data, {
		runTaskIntake: (input) => runTaskIntake(cliExecutor, input),
	});
	return jsonSuccess(result);
}

export async function composeTaskChatCreate(
	input: TaskChatCreateRequest,
	deps: {
		runTaskIntake(
			input: TaskChatCreateRequest,
		): Promise<TaskChatCreateIntakeResult>;
	},
): Promise<TaskChatCreateResponse> {
	const intake = await settle(() => deps.runTaskIntake(input));
	if (!intake.ok) {
		return { status: "db_error", error: intake.error };
	}
	if (intake.value.status === "needs_info") {
		return intake.value;
	}
	return { status: "created", task: intake.value.task };
}

async function runTaskIntake(
	cliExecutor: CliExecutor,
	input: TaskChatCreateRequest,
): Promise<TaskChatCreateIntakeResult> {
	const result = await cliExecutor.execute({
		action: "task",
		taskAction: "create",
		request: input.request,
		projectId: input.projectId,
		nonInteractive: true,
		clarificationAnswers: input.answers,
		json: true,
	});
	if (result.status !== "succeeded") {
		throw new Error(result.error ?? "Task creation failed");
	}
	return parseTaskIntakeOutput(result.commandResult?.stdout ?? "");
}

function parseTaskIntakeOutput(output: string): TaskChatCreateIntakeResult {
	const line = output
		.split("\n")
		.map((value) => value.trim())
		.filter(Boolean)
		.at(-1);
	if (!line) {
		throw new Error("Task creation returned no structured output");
	}
	const parsed = JSON.parse(line) as unknown;
	return intakeResultSchema.parse(parsed);
}

const boardTaskSchema = z.object({
	id: z.string().min(1),
	taskKey: z.string().min(1),
	projectId: z.string().nullable(),
	title: z.string().min(1),
	content: z.string().min(1),
	priority: z.number().int(),
	status: z.string().min(1),
	dueDate: z.string().nullable(),
	creatorId: z.string().min(1),
	linkedPr: z.string().nullable(),
	linearIssueId: z.string().nullable(),
	linearIdentifier: z.string().nullable(),
	linearUrl: z.string().nullable(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
}) satisfies z.ZodType<BoardTaskRow>;

const intakeResultSchema = z.union([
	z.object({
		status: z.literal("created"),
		task: boardTaskSchema,
	}),
	z.object({
		status: z.literal("needs_info"),
		questions: z.array(z.string().min(1)).min(1),
	}),
]);

async function settle<T>(
	run: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
	try {
		return { ok: true, value: await run() };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
