export interface TextPromptOptions {
	message: string;
	defaultValue?: string;
	initialValue?: string;
	placeholder?: string;
	validate?: (value: string | undefined) => string | Error | undefined;
}

export interface PasswordPromptOptions {
	message: string;
	validate?: (value: string | undefined) => string | Error | undefined;
}

export interface ConfirmPromptOptions {
	message: string;
	initialValue?: boolean;
}

export interface SelectPromptOption<Value extends string> {
	value: Value;
	label?: string;
	hint?: string;
	disabled?: boolean;
}

export interface SelectPromptOptions<Value extends string> {
	message: string;
	options: Array<SelectPromptOption<Value>>;
	initialValue?: Value;
}

export interface PromptAdapter {
	text(options: TextPromptOptions): Promise<string>;
	password(options: PasswordPromptOptions): Promise<string>;
	confirm(options: ConfirmPromptOptions): Promise<boolean>;
	select<Value extends string>(
		options: SelectPromptOptions<Value>,
	): Promise<Value>;
}

export interface PromptBackend {
	text(options: TextPromptOptions): Promise<string | symbol>;
	password(options: PasswordPromptOptions): Promise<string | symbol>;
	confirm(options: ConfirmPromptOptions): Promise<boolean | symbol>;
	select<Value extends string>(
		options: SelectPromptOptions<Value>,
	): Promise<Value | symbol>;
	cancel(message?: string): void;
	isCancel(value: unknown): boolean;
}
