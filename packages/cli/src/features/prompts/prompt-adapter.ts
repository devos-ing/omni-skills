import {
	cancel,
	confirm,
	isCancel,
	password,
	select,
	text,
} from "@clack/prompts";
import { renderCliMutedText } from "../../utils/terminal-format";
import type {
	ConfirmPromptOptions,
	PasswordPromptOptions,
	PromptAdapter,
	PromptBackend,
	SelectPromptOptions,
	TextPromptOptions,
} from "./types/prompt-adapter.types";

export class PromptCancelledError extends Error {
	constructor() {
		super("Operation cancelled");
		this.name = "PromptCancelledError";
	}
}

export function createPromptAdapter(backend: PromptBackend): PromptAdapter {
	return {
		async text(options) {
			const value = await backend.text(withPromptDescription(options));
			return resolveTextValue(backend, value, options.defaultValue);
		},
		async password(options) {
			const value = await backend.password(withPromptDescription(options));
			return resolveTextValue(backend, value);
		},
		async confirm(options) {
			const value = await backend.confirm(withPromptDescription(options));
			return resolvePromptValue(backend, value);
		},
		async select(options) {
			const value = await backend.select(withPromptDescription(options));
			return resolvePromptValue(backend, value);
		},
	};
}

export const clackPromptAdapter = createPromptAdapter({
	text,
	password,
	confirm,
	select,
	cancel,
	isCancel,
});

function resolveTextValue(
	backend: PromptBackend,
	value: string | symbol,
	defaultValue = "",
): string {
	return resolvePromptValue(backend, value).trim() || defaultValue;
}

function withPromptDescription<
	Options extends { message: string; description?: string },
>(options: Options): Options {
	const description = options.description?.trim();
	if (!description) return options;
	return {
		...options,
		description: renderCliMutedText(description),
	};
}

function resolvePromptValue<Value>(
	backend: PromptBackend,
	value: Value | symbol,
): Value {
	if (backend.isCancel(value)) {
		backend.cancel("Operation cancelled");
		throw new PromptCancelledError();
	}
	return value as Value;
}

export type {
	ConfirmPromptOptions,
	PasswordPromptOptions,
	PromptAdapter,
	PromptBackend,
	SelectPromptOptions,
	TextPromptOptions,
};
