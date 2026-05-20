import type { ServerDatabase } from "devos-db";
import { z } from "zod";
import type { CliExecutor } from "../app.types";
import type { RealtimeEventPublisher } from "../realtime";
import { createTaskRepository, createTaskService } from "../tasks";
import {
	composeTaskChatCreate,
	runTaskIntake,
} from "../tasks/task-chat-service";
import {
	badRequest,
	methodNotAllowed,
	parseObjectJsonBody,
} from "./http-utils";
import { jsonSuccess } from "./response";

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
	db: ServerDatabase["db"],
	cliExecutor: CliExecutor,
	realtimeEvents?: RealtimeEventPublisher,
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
	const taskService = createTaskService(createTaskRepository(db));
	const result = await composeTaskChatCreate(parsed.data, {
		runTaskIntake: (input) => runTaskIntake(cliExecutor, input),
		persistCreatedTask: async (input, task) => {
			const persisted = await taskService.ensureChatCreatedTask(input, task);
			if (persisted.status !== "ok") {
				throw new Error(mapTaskPersistenceError(persisted.status));
			}
			return persisted.value;
		},
	});
	if (result.status === "created") {
		realtimeEvents?.publish({ type: "issue.created", issue: result.task });
	}
	return jsonSuccess(result);
}

function mapTaskPersistenceError(
	status: "not_found" | "foreign_key_error" | "invalid_payload",
): string {
	if (status === "foreign_key_error") {
		return "Foreign key constraint failed";
	}
	return "Invalid task create payload";
}
