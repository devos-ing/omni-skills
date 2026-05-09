import { describe, expect, it } from "bun:test";
import {
	appendStatusEmoji,
	formatWorkflowStageDisplay,
} from "../src/utils/status";

describe("formatWorkflowStageDisplay", () => {
	it("adds an emoji indicator for workflow stage", () => {
		expect(formatWorkflowStageDisplay("planning")).toBe("planning 🧭");
		expect(formatWorkflowStageDisplay("done")).toBe("done ✅");
	});
});

describe("appendStatusEmoji", () => {
	it("adds emoji for supported status labels", () => {
		expect(appendStatusEmoji("DONE")).toBe("DONE ✅");
		expect(appendStatusEmoji("HUMAN REVIEW REQUIRED")).toBe(
			"HUMAN REVIEW REQUIRED 🙋",
		);
	});

	it("leaves unsupported labels unchanged", () => {
		expect(appendStatusEmoji("UNKNOWN")).toBe("UNKNOWN");
	});
});
