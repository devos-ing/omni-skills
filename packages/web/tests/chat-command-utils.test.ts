import { describe, expect, it } from "bun:test";
import {
	commandFinalText,
	getChatCommandSuggestions,
	isChatCommandMenuDraft,
	parseChatCommand,
} from "../src/components/chat-room/chat-command-utils";

describe("chat command parsing", () => {
	it("treats regular text as a task message", () => {
		expect(parseChatCommand("build chat", { projectId: "default" })).toEqual({
			kind: "none",
		});
	});

	it("parses local session and project commands", () => {
		expect(parseChatCommand("/new", { projectId: "default" })).toEqual({
			kind: "local",
			action: "new",
		});
		expect(parseChatCommand("/project core", { projectId: null })).toEqual({
			kind: "local",
			action: "project",
			projectId: "core",
		});
	});

	it("builds workflow command requests", () => {
		expect(parseChatCommand("/run TASK-1", { projectId: "default" })).toEqual({
			kind: "stream",
			action: "run",
			label: "Run TASK-1",
			request: { action: "run", projectId: "default", issueKey: "TASK-1" },
		});
		expect(parseChatCommand("/skills", { projectId: null })).toEqual({
			kind: "stream",
			action: "skills",
			label: "List skills",
			request: { action: "skills", skillsAction: "list" },
		});
		expect(parseChatCommand("/onboard --check", { projectId: null })).toEqual({
			kind: "stream",
			action: "onboard",
			label: "Onboard",
			request: { action: "onboard", check: true },
		});
	});

	it("returns validation errors for incomplete commands", () => {
		expect(parseChatCommand("/run", { projectId: "default" })).toEqual({
			kind: "error",
			error: "Usage: /run <issue-key>",
		});
		expect(parseChatCommand("/status TASK-1", { projectId: null })).toEqual({
			kind: "error",
			error: "Select a project before /status.",
		});
	});

	it("formats command completion text", () => {
		expect(commandFinalText("succeeded", "ok")).toBe("Command completed.\nok");
		expect(commandFinalText("failed", "")).toBe("Command failed.");
	});
});

describe("chat command suggestions", () => {
	it("shows all commands for a bare slash", () => {
		expect(getChatCommandSuggestions("/").map((item) => item.command)).toEqual([
			"/new",
			"/project",
			"/run",
			"/status",
			"/skills",
			"/onboard",
		]);
	});

	it("filters commands while the user types", () => {
		expect(
			getChatCommandSuggestions("/sta").map((item) => item.command),
		).toEqual(["/status"]);
		expect(
			getChatCommandSuggestions("/ski").map((item) => item.command),
		).toEqual(["/skills"]);
	});

	it("hides suggestions once command arguments begin", () => {
		expect(isChatCommandMenuDraft("/run")).toBe(true);
		expect(isChatCommandMenuDraft("/run ")).toBe(false);
		expect(getChatCommandSuggestions("/run TASK-1")).toEqual([]);
	});
});
