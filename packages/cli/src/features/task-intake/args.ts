import { readFlagValue } from "../../args-utils";
import type { TaskCommand } from "../../args.types";

export function parseTaskCommand(args: string[]): TaskCommand {
	const action = args[0];
	if (!action) {
		throw new Error("task command requires an action: create");
	}
	if (action !== "create") {
		throw new Error(`Unknown task action: ${action}`);
	}
	const actionArgs = args.slice(1);
	const request = readFlagValue(actionArgs, "--request");
	const positionalRequest = request ?? readPositionalRequest(actionArgs);
	return {
		action: "create",
		projectId: readFlagValue(actionArgs, "--project"),
		request: positionalRequest,
	};
}

function readPositionalRequest(args: string[]): string | undefined {
	const positional: string[] = [];
	for (let index = 0; index < args.length; index += 1) {
		const token = args[index];
		if (!token) {
			continue;
		}
		if (token === "--request" || token === "--project") {
			index += 1;
			continue;
		}
		if (token.startsWith("--")) {
			continue;
		}
		positional.push(token);
	}
	return positional.length > 0 ? positional.join(" ") : undefined;
}
