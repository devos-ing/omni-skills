import type {
	AgentAdapter,
	AgentAdapterRuntimeConfig,
	AgentResult,
} from "../agent-adapter.types";
import { runCommand } from "../shell";
import { getClaudeBinaryPath } from "./path";

export class ClaudeCodeAdapter implements AgentAdapter {
	private claudePath: string;

	constructor(private config: AgentAdapterRuntimeConfig) {
		this.claudePath = getClaudeBinaryPath(config.codex?.binary);
	}

	async runPlan(prompt: string): Promise<AgentResult> {
		return this.runClaude(prompt);
	}

	async runTaskIntake(prompt: string): Promise<AgentResult> {
		return this.runClaude(prompt);
	}

	async resume(sessionId: string, prompt: string): Promise<AgentResult> {
		return this.runClaudeResume(sessionId, prompt);
	}

	async runReview(prompt: string): Promise<AgentResult> {
		return this.runClaude(prompt);
	}

	async runGithubComment(prompt: string): Promise<AgentResult> {
		return this.runClaude(prompt);
	}

	private buildModelArgs(): string[] {
		const model = this.config.claude?.model ?? this.config.agent?.model;
		if (!model) return [];
		return ["--model", model];
	}

	private buildMaxTurnsArgs(): string[] {
		const maxTurns =
			this.config.claude?.maxTurns ?? this.config.agent?.maxTurns;
		if (!maxTurns || maxTurns <= 0) return [];
		return ["--max-turns", String(maxTurns)];
	}

	private buildAllowedToolsArgs(): string[] {
		const tools =
			this.config.claude?.allowedTools ?? this.config.agent?.allowedTools;
		if (!tools || tools.length === 0) return [];
		return ["--allowedTools", ...tools];
	}

	private buildCommonArgs(): string[] {
		const permissionMode =
			this.config.claude?.permissionMode ??
			this.config.agent?.permissionMode ??
			"bypassPermissions";
		return [
			"--output-format",
			"json",
			"--permission-mode",
			permissionMode,
			...this.buildModelArgs(),
			...this.buildMaxTurnsArgs(),
			...this.buildAllowedToolsArgs(),
		];
	}

	private async runClaude(prompt: string): Promise<AgentResult> {
		const args = ["-p", prompt, ...this.buildCommonArgs()];

		const result = await runCommand(this.claudePath, args, {
			cwd: this.config.executionPath,
			streamStdout: this.config.codex.streamLogs,
			streamStderr: this.config.codex.streamLogs,
			stdinMode: "ignore",
		});

		if (result.code !== 0) {
			throw mapClaudeError(this.claudePath, args, result);
		}

		const finalMessage = extractFinalMessage(result.stdout);
		const sessionId = extractSessionId(result.stdout);
		const usage = extractUsage(result.stdout);

		return {
			sessionId,
			finalMessage,
			stdout: result.stdout,
			usage,
		};
	}

	private async runClaudeResume(
		sessionId: string,
		prompt: string,
	): Promise<AgentResult> {
		const args = [
			"--resume",
			sessionId,
			"-p",
			prompt,
			...this.buildCommonArgs(),
		];

		const result = await runCommand(this.claudePath, args, {
			cwd: this.config.executionPath,
			streamStdout: this.config.codex.streamLogs,
			streamStderr: this.config.codex.streamLogs,
			stdinMode: "ignore",
		});

		if (result.code !== 0) {
			throw mapClaudeError(this.claudePath, args, result);
		}

		const finalMessage = extractFinalMessage(result.stdout);
		const resumedSessionId = extractSessionId(result.stdout) ?? sessionId;
		const usage = extractUsage(result.stdout);

		return {
			sessionId: resumedSessionId,
			finalMessage,
			stdout: result.stdout,
			usage,
		};
	}
}

function extractFinalMessage(jsonOutput: string): string {
	try {
		const parsed = JSON.parse(jsonOutput) as Record<string, unknown>;
		if (typeof parsed.result === "string") return parsed.result;
		if (typeof parsed.content === "string") return parsed.content;
		if (typeof parsed.message === "string") return parsed.message;
		if (Array.isArray(parsed.messages)) {
			const last = parsed.messages[parsed.messages.length - 1];
			if (
				last &&
				typeof last === "object" &&
				typeof last.content === "string"
			) {
				return last.content;
			}
		}
	} catch {}
	return jsonOutput;
}

export function extractSessionId(jsonOutput: string): string | undefined {
	try {
		const parsed = JSON.parse(jsonOutput) as Record<string, unknown>;
		const id =
			parsed.session_id ??
			parsed.sessionId ??
			parsed.conversation_id ??
			parsed.conversationId;
		if (typeof id === "string") {
			return id;
		}
	} catch {}
	return undefined;
}

export function extractUsage(
	jsonOutput: string,
): AgentResult["usage"] | undefined {
	try {
		const parsed = JSON.parse(jsonOutput) as Record<string, unknown>;
		const usage = parsed.usage as Record<string, unknown> | undefined;
		if (!usage) {
			return undefined;
		}
		return {
			inputTokens:
				typeof usage.input_tokens === "number" ? usage.input_tokens : undefined,
			outputTokens:
				typeof usage.output_tokens === "number"
					? usage.output_tokens
					: undefined,
			totalTokens:
				typeof usage.total_tokens === "number" ? usage.total_tokens : undefined,
		};
	} catch {}
	return undefined;
}

function mapClaudeError(
	command: string,
	args: string[],
	result: { code: number; stdout: string; stderr: string },
): Error {
	const output = result.stderr || result.stdout;
	const base = `${command} ${args.join(" ")} failed with exit code ${result.code}`;

	if (output.includes("rate limit") || output.includes("429")) {
		return new Error(
			`${base}\nClaude API rate limit hit. Wait a moment and retry, or set CLAUDE_CODE_MODEL to a model with higher limits.`,
		);
	}

	if (
		output.includes("authentication") ||
		output.includes("API key") ||
		output.includes("ANTHROPIC_API_KEY")
	) {
		return new Error(
			`${base}\nClaude Code authentication failed. Run 'claude' interactively once to log in, or set ANTHROPIC_API_KEY in your environment.`,
		);
	}

	if (output.includes("model") && output.includes("not found")) {
		return new Error(
			`${base}\nThe specified model was not found. Check CLAUDE_CODE_MODEL in your .env file.`,
		);
	}

	if (result.code === 127) {
		return new Error(
			`${base}\nClaude Code binary not found. Install with: npm install -g @anthropic-ai/claude-code`,
		);
	}

	return new Error(`${base}\n${output}`);
}
