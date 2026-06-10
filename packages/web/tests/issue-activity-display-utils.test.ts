import { describe, expect, it } from "bun:test";

import { formatOperatorActivityText } from "../src/components/issues-board/issue-activity-display-utils";

describe("issue activity display utilities", () => {
	it("extracts operator-readable fields from structured output", () => {
		const text = formatOperatorActivityText(
			JSON.stringify({
				command: "codex exec --prompt secret",
				payload: { prompt: "internal command payload" },
				planning: "Plan the focused UI sanitizer.",
				result: "Activity output is ready for review.",
				thinking: "The raw command is not useful to operators.",
			}),
		);

		expect(text).toBe(
			[
				"Result: Activity output is ready for review.",
				"Thinking: The raw command is not useful to operators.",
				"Planning: Plan the focused UI sanitizer.",
			].join("\n"),
		);
		expect(text).not.toContain("codex exec");
		expect(text).not.toContain("payload");
	});

	it("suppresses command-only structured output", () => {
		expect(
			formatOperatorActivityText(
				JSON.stringify({
					command: "bun test --filter secret",
					payload: { argv: ["bun", "test"] },
				}),
			),
		).toBe("");
	});

	it("preserves normal prose while removing raw JSON field dumps", () => {
		const text = formatOperatorActivityText(
			[
				"Implemented the activity formatter.",
				'"command": "codex exec --prompt secret",',
				"Validated focused tests.",
			].join("\n"),
		);

		expect(text).toBe(
			["Implemented the activity formatter.", "Validated focused tests."].join(
				"\n",
			),
		);
		expect(text).not.toContain("codex exec");
	});

	it("suppresses embedded pretty-printed command payload blocks", () => {
		const text = formatOperatorActivityText(
			[
				"prefix",
				"{",
				'  "command": "codex exec --prompt secret",',
				'  "payload": {',
				'    "prompt": "internal prompt"',
				"  }",
				"}",
				"suffix",
			].join("\n"),
		);

		expect(text).toBe(["prefix", "suffix"].join("\n"));
		expect(text).not.toContain("codex exec");
		expect(text).not.toContain("internal prompt");
	});

	it("extracts embedded JSON results when strings contain unmatched delimiters", () => {
		const text = formatOperatorActivityText(
			[
				"prefix",
				"{",
				'  "result": "Remove the trailing } character.",',
				'  "payload": {',
				'    "prompt": "secret"',
				"  }",
				"}",
				"suffix",
			].join("\n"),
		);

		expect(text).toBe(
			["prefix", "Result: Remove the trailing } character.", "suffix"].join(
				"\n",
			),
		);
		expect(text).not.toContain("prompt");
		expect(text).not.toContain("secret");
		expect(text).not.toContain("{");
	});
});
