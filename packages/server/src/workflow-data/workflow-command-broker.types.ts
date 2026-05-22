import type { CliCommandExecutionResult } from "devos/features/server";
import type { CliExecutor } from "../app.types";
import type { WorkflowDataSocket } from "./workflow-data-socket.types";
import type {
	WorkflowClientCommandFrame,
	WorkflowCommandStreamFrame,
} from "./workflow-data.types";

export interface WorkflowCommandBroker extends CliExecutor {
	dispatchCommand(
		frame: WorkflowClientCommandFrame,
		emit: (frame: WorkflowCommandStreamFrame) => void,
	): Promise<CliCommandExecutionResult>;
	handleWorkerFrame(frame: WorkflowCommandStreamFrame): void;
	registerWorker(socket: WorkflowDataSocket, workerId: string): void;
}
