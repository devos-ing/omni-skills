import type {
	Guardrail,
	GuardrailResult,
	GuardrailStage,
} from "./types/agent.types";

export class BasicGuardrail<TInput = unknown, TOutput = unknown>
	implements Guardrail<TInput, TOutput>
{
	readonly name: string;
	readonly stage: GuardrailStage;
	private readonly checkFn: Guardrail<TInput, TOutput>["check"];

	constructor(options: Guardrail<TInput, TOutput>) {
		this.name = options.name;
		this.stage = options.stage;
		this.checkFn = options.check;
	}

	check(input: Parameters<Guardrail<TInput, TOutput>["check"]>[0]) {
		return this.checkFn(input);
	}
}

export class InputGuardrail<TInput = unknown> extends BasicGuardrail<
	TInput,
	unknown
> {
	constructor(options: Omit<Guardrail<TInput, unknown>, "stage">) {
		super({ ...options, stage: "input" });
	}
}

export class OutputGuardrail<TOutput = unknown> extends BasicGuardrail<
	unknown,
	TOutput
> {
	constructor(options: Omit<Guardrail<unknown, TOutput>, "stage">) {
		super({ ...options, stage: "output" });
	}
}

export class ToolGuardrail extends BasicGuardrail {
	constructor(options: Omit<Guardrail, "stage">) {
		super({ ...options, stage: "tool" });
	}
}

export function guardrailPass(): GuardrailResult {
	return { ok: true };
}
