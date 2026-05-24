import { arch, hostname, platform, userInfo } from "node:os";
import type {
	WorkflowCommandWorkerOptions,
	WorkflowComputerRegistration,
} from "./workflow-command-worker.types";

export function buildWorkflowComputerRegistration(
	options: Pick<WorkflowCommandWorkerOptions, "cwd" | "env">,
): WorkflowComputerRegistration {
	const resolvedHostname = hostname();
	const name =
		options.env?.DEVOS_COMPUTER_NAME?.trim() ||
		options.env?.COMPUTERNAME?.trim() ||
		resolvedHostname;
	const id =
		options.env?.DEVOS_COMPUTER_ID?.trim() || normalizeComputerId(name);
	const user = safeUsername();

	return {
		id,
		name,
		hostname: resolvedHostname,
		platform: platform(),
		arch: arch(),
		cwd: options.cwd,
		startedAt: new Date().toISOString(),
		processId: process.pid,
		...(user ? { user } : {}),
	};
}

function normalizeComputerId(value: string): string {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || "local-computer";
}

function safeUsername(): string | undefined {
	try {
		return userInfo().username;
	} catch {
		return undefined;
	}
}
