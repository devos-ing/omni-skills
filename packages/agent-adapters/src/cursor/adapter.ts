import type {
	AgentAdapter,
	AgentAdapterRuntimeConfig,
	AgentResult,
} from "../agent-adapter.types";
import { runCommand } from "../shell";

export class CursorAgentAdapter implements AgentAdapter {
	constructor(private config: AgentAdapterRuntimeConfig) {}

	async runPlan(prompt: string): Promise<AgentResult> {
		return this.runNewSession(prompt);
	}

	async runTaskIntake(prompt: string): Promise<AgentResult> {
		return this.runNewSession(prompt);
	}

	async resume(sessionId: string, prompt: string): Promise<AgentResult> {
		return this.runCursor(this.buildResumeArgs(sessionId, prompt));
	}

	async runReview(prompt: string): Promise<AgentResult> {
		return this.runNewSession(prompt);
	}

	async runGithubComment(prompt: string): Promise<AgentResult> {
		return this.runNewSession(prompt);
	}

	private async runNewSession(prompt: string): Promise<AgentResult> {
		return this.runCursor(this.buildNewSessionArgs(prompt));
	}

	private buildNewSessionArgs(prompt: string): string[] {
		return this.appendOptionalArgs(["-p", prompt, "--output-format", "json"]);
	}

	private buildResumeArgs(sessionId: string, prompt: string): string[] {
		return this.appendOptionalArgs([
			"--resume",
			sessionId,
			"-p",
			prompt,
			"--output-format",
			"json",
		]);
	}

	private appendOptionalArgs(args: string[]): string[] {
		const model = this.config.cursor?.model?.trim();
		if (model && model.toLowerCase() !== "auto") {
			args.push("--model", model);
		}
		if (this.config.cursor?.force) {
			args.push("--force");
		}
		return args;
	}

	private async runCursor(args: string[]): Promise<AgentResult> {
		const binary = this.config.cursor?.binary ?? "cursor-agent";
		const result = await runCommand(binary, args, {
			cwd: this.config.executionPath,
			env: this.buildEnv(),
			streamStdout:
				this.config.cursor?.streamLogs ?? this.config.codex.streamLogs,
			streamStderr:
				this.config.cursor?.streamLogs ?? this.config.codex.streamLogs,
			stdinMode: "ignore",
		});

		if (result.code !== 0) {
			throw mapCursorError(binary, args, result);
		}

		return {
			sessionId: extractSessionId(result.stdout),
			finalMessage: extractFinalMessage(result.stdout),
			stdout: result.stdout,
		};
	}

	private buildEnv(): Record<string, string> | undefined {
		const apiKey = this.config.cursor?.apiKey?.trim();
		return apiKey ? { CURSOR_API_KEY: apiKey } : undefined;
	}
}

export function extractFinalMessage(jsonOutput: string): string {
	try {
		const parsed = JSON.parse(jsonOutput) as Record<string, unknown>;
		return typeof parsed.result === "string" ? parsed.result : jsonOutput;
	} catch {}
	return jsonOutput;
}

export function extractSessionId(jsonOutput: string): string | undefined {
	try {
		const parsed = JSON.parse(jsonOutput) as Record<string, unknown>;
		const id = parsed.session_id ?? parsed.sessionId;
		return typeof id === "string" ? id : undefined;
	} catch {}
	return undefined;
}

export function mapCursorError(
	command: string,
	args: string[],
	result: { code: number; stdout: string; stderr: string },
): Error {
	const output = result.stderr || result.stdout;
	const base = `${command} ${args.join(" ")} failed with exit code ${result.code}`;

	if (result.code === 127 || output.includes("command not found")) {
		return new Error(
			`${base}\nCursor Agent binary not found. Install Cursor Agent CLI and run 'cursor-agent login', or set CURSOR_AGENT_BINARY.`,
		);
	}
	if (
		output.includes("authentication") ||
		output.includes("API key") ||
		output.includes("CURSOR_API_KEY") ||
		output.includes("login")
	) {
		return new Error(
			`${base}\nCursor Agent authentication failed. Run 'cursor-agent login' or set CURSOR_API_KEY.`,
		);
	}
	if (output.includes("rate limit") || output.includes("429")) {
		return new Error(`${base}\nCursor Agent rate limit hit. Retry later.`);
	}
	if (output.includes("model") && output.includes("not found")) {
		return new Error(
			`${base}\nThe specified Cursor Agent model was not found. Check CURSOR_AGENT_MODEL.`,
		);
	}

	return new Error(`${base}\n${output}`);
}
