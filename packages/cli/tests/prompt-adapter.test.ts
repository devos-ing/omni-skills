import { describe, expect, it } from "bun:test";
import {
	PromptCancelledError,
	createPromptAdapter,
} from "../src/features/prompts";
import type {
	PromptBackend,
	SelectPromptOptions,
} from "../src/features/prompts";

describe("prompt adapter", () => {
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
