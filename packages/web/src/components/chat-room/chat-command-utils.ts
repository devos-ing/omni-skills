import type {
	ChatCommandContext,
	ParsedChatCommand,
} from "./types/chat-room.types";

export const CHAT_COMMANDS = [
	{ command: "/new", hint: "Start a new session" },
	{ command: "/project", hint: "Switch project: /project default" },
	{ command: "/run", hint: "Run an issue: /run TASK-1" },
	{ command: "/status", hint: "Check issue status: /status TASK-1" },
	{ command: "/skills", hint: "List project skills" },
	{ command: "/onboard", hint: "Run onboarding checks" },
] as const;

export function isChatCommandMenuDraft(input: string): boolean {
	return /^\/[^\s]*$/.test(input);
}

export function getChatCommandSuggestions(
	input: string,
): (typeof CHAT_COMMANDS)[number][] {
	if (!isChatCommandMenuDraft(input)) {
		return [];
	}
	const query = input.slice(1).toLowerCase();
	if (!query) {
		return [...CHAT_COMMANDS];
	}
	return CHAT_COMMANDS.filter((item) => {
		const command = item.command.slice(1).toLowerCase();
		return command.startsWith(query);
	});
}

export function parseChatCommand(
	input: string,
	context: ChatCommandContext,
): ParsedChatCommand {
	const trimmed = input.trim();
	if (!trimmed.startsWith("/")) {
		return { kind: "none" };
	}
	const [name = "", ...args] = trimmed.split(/\s+/);
	const projectId = context.projectId ?? undefined;
	if (name === "/new") {
		return { kind: "local", action: "new" };
	}
	if (name === "/project") {
		const nextProjectId = args[0]?.trim();
		return nextProjectId
			? { kind: "local", action: "project", projectId: nextProjectId }
			: { kind: "error", error: "Usage: /project <project-id>" };
	}
	if (name === "/run") {
		const issueKey = args[0]?.trim();
		if (!projectId) {
			return { kind: "error", error: "Select a project before /run." };
		}
		return issueKey
			? {
					kind: "stream",
					action: "run",
					label: `Run ${issueKey}`,
					request: { action: "run", projectId, issueKey },
				}
			: { kind: "error", error: "Usage: /run <issue-key>" };
	}
	if (name === "/status") {
		const issueKey = args[0]?.trim();
		if (!projectId) {
			return { kind: "error", error: "Select a project before /status." };
		}
		return issueKey
			? {
					kind: "stream",
					action: "status",
					label: `Status ${issueKey}`,
					request: { action: "status", projectId, issueKey },
				}
			: { kind: "error", error: "Usage: /status <issue-key>" };
	}
	if (name === "/skills") {
		return {
			kind: "stream",
			action: "skills",
			label: "List skills",
			request: projectId
				? { action: "skills", skillsAction: "list", projectId }
				: { action: "skills", skillsAction: "list" },
		};
	}
	if (name === "/onboard") {
		return {
			kind: "stream",
			action: "onboard",
			label: "Onboard",
			request: { action: "onboard", check: args.includes("--check") },
		};
	}
	return { kind: "error", error: `Unknown command: ${name}` };
}

export function commandFinalText(status: string, output: string): string {
	const headline =
		status === "succeeded" ? "Command completed." : "Command failed.";
	return output.trim() ? `${headline}\n${output.trim()}` : headline;
}
