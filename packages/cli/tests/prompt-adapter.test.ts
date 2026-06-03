import { describe, expect, it } from "bun:test";
import {
	PromptCancelledError,
	createPromptAdapter,
} from "../src/features/prompts";
import type {
	PromptBackend,
	SelectPromptOptions,
} from "../src/features/prompts";
import { renderCliMutedText } from "../src/utils/terminal-format";

describe("prompt adapter", () => {
	it("passes prompt descriptions separately with the muted CLI style", async () => {
		const prompts: Array<{ message: string; description?: string }> = [];
		const adapter = createPromptAdapter(
			backend({
				text: async (options) => {
					prompts.push({
						message: options.message,
						description: options.description,
					});
					return "answered";
				},
				confirm: async (options) => {
					prompts.push({
						message: options.message,
						description: options.description,
					});
					return true;
				},
			}),
		);

		await adapter.text({
			message: "Workspace name",
			description: "Names this local devos workspace.",
		});
		await adapter.confirm({
			message: "Use isolated worktrees?",
			description: "Keeps agent changes out of the main checkout.",
		});

		expect(prompts).toEqual([
			{
				message: "Workspace name",
				description: renderCliMutedText("Names this local devos workspace."),
			},
			{
				message: "Use isolated worktrees?",
				description: renderCliMutedText(
					"Keeps agent changes out of the main checkout.",
				),
			},
		]);
	});

	it("trims text values and falls back to defaults for blank input", async () => {
		const adapter = createPromptAdapter(
			backend({
				text: async (options) =>
					options.message === "blank" ? "   " : "  answered  ",
			}),
		);

		await expect(
			adapter.text({ message: "value", defaultValue: "fallback" }),
		).resolves.toBe("answered");
		await expect(
			adapter.text({ message: "blank", defaultValue: "fallback" }),
		).resolves.toBe("fallback");
	});

	it("normalizes password, confirm, and select prompt results", async () => {
		const adapter = createPromptAdapter(
			backend({
				password: async () => " secret ",
				confirm: async () => true,
				select: selectValue("medium"),
			}),
		);

		await expect(adapter.password({ message: "Password" })).resolves.toBe(
			"secret",
		);
		await expect(adapter.confirm({ message: "Confirm" })).resolves.toBe(true);
		await expect(
			adapter.select({
				message: "Select",
				options: [{ value: "medium" }, { value: "low" }],
			}),
		).resolves.toBe("medium");
	});

	it("cancels through Clack and throws a prompt cancellation error", async () => {
		const cancelled = Symbol("cancelled");
		let cancelMessage: string | undefined;
		const adapter = createPromptAdapter(
			backend({
				text: async () => cancelled,
				cancel: (message) => {
					cancelMessage = message;
				},
				isCancel: (value) => value === cancelled,
			}),
		);

		await expect(adapter.text({ message: "Stop" })).rejects.toBeInstanceOf(
			PromptCancelledError,
		);
		expect(cancelMessage).toBe("Operation cancelled");
	});
});

function backend(overrides: Partial<PromptBackend>): PromptBackend {
	return {
		text: async () => "",
		password: async () => "",
		confirm: async () => false,
		select: async (options) => options.options[0]?.value ?? "",
		cancel: () => {},
		isCancel: () => false,
		...overrides,
	};
}

function selectValue(value: string): PromptBackend["select"] {
	return async <Value extends string>(options: SelectPromptOptions<Value>) =>
		options.options.find((option) => option.value === value)?.value ??
		options.options[0]?.value ??
		("" as Value);
}
