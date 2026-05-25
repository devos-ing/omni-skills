import { describe, expect, it } from "bun:test";

import {
	getChatCommandSuggestions,
	isChatCommandMenuDraft,
} from "../src/components/chat-room/chat-command-utils";

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
