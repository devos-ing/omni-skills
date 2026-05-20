import type { BoardTaskRow } from "devos-db";
import { z } from "zod";
import type { CliExecutor } from "../app.types";
import type {
	TaskChatCreateIntakeResult,
	TaskChatCreateRequest,
	TaskChatCreateResponse,
} from "../http/task-chat-create.types";

export async function composeTaskChatCreate(
	input: TaskChatCreateRequest,
	deps: {
		runTaskIntake(
			input: TaskChatCreateRequest,
		): Promise<TaskChatCreateIntakeResult>;
		persistCreatedTask(
			input: TaskChatCreateRequest,
			task: BoardTaskRow,
		): Promise<BoardTaskRow>;
	},
): Promise<TaskChatCreateResponse> {
	const intake = await settle(() => deps.runTaskIntake(input));
	if (!intake.ok) {
		return { status: "db_error", error: intake.error };
	}
	if (intake.value.status === "needs_info") {
		return intake.value;
	}
	const createdTask = intake.value.task;
	const persisted = await settle(() =>
		deps.persistCreatedTask(input, createdTask),
	);
	if (!persisted.ok) {
		return { status: "db_error", error: persisted.error };
	}
	return { status: "created", task: persisted.value };
}

export async function runTaskIntake(
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

export function parseTaskIntakeOutput(
	output: string,
): TaskChatCreateIntakeResult {
	const line = output
		.split("\n")
		.map((value) => value.trim())
		.filter(Boolean)
		.at(-1);
	if (!line) {
		throw new Error("Task creation returned no structured output");
	}
	const parsed = JSON.parse(line) as unknown;
	const record = assertRecord(parsed);
	if (record?.status === "linear_error") {
		throw new Error(
			`Task creation returned legacy Linear error output: ${readErrorMessage(record)}`,
		);
	}
	const result = intakeResultSchema.safeParse(
		normalizeLegacyTaskCreateOutput(parsed),
	);
	if (!result.success) {
		throw new Error(
			'Task creation returned invalid structured output. Expected {"status":"created","task":{...,"content":"..."}} or {"status":"needs_info","questions":[...]}.',
		);
	}
	return result.data;
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

function normalizeLegacyTaskCreateOutput(output: unknown): unknown {
	const record = assertRecord(output);
	if (record?.status !== "created") {
		return output;
	}
	const task = assertRecord(record.task);
	if (!task || typeof task.content === "string") {
		return output;
	}
	if (typeof task.description !== "string") {
		return output;
	}
	return { ...record, task: { ...task, content: task.description } };
}

function assertRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function readErrorMessage(record: Record<string, unknown>): string {
	return typeof record.error === "string" && record.error.trim()
		? record.error
		: "unknown legacy Linear failure";
}

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
