import { clackPromptAdapter } from "../prompts";
import type { PromptAdapter } from "../prompts";

export async function readStdinText(): Promise<string> {
	let input = "";
	for await (const chunk of process.stdin) {
		input += chunk.toString();
	}
	return input.trim();
}

export async function withQuestionReader<T>(
	run: (askQuestion: (question: string) => Promise<string>) => Promise<T>,
	prompts: PromptAdapter = clackPromptAdapter,
): Promise<T> {
	return await run((question) => prompts.text({ message: question }));
}
