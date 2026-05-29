import { z } from "zod";
import type {
	AgentAdapterRunRequest,
	AgentAdapterRuntimeConfig,
} from "./types/agent-adapter.types";

const backendSchema = z.enum([
	"codex",
	"claude-code",
	"cursor-agent",
	"opencode",
]);
const reasoningEffortSchema = z.enum(["low", "medium", "high", "xhigh"]);
const permissionModeSchema = z.enum([
	"default",
	"acceptEdits",
	"bypassPermissions",
	"dontAsk",
	"plan",
]);
const sandboxSchema = z.enum([
	"read-only",
	"workspace-write",
	"danger-full-access",
]);

const stageConfigSchema = z.object({
	brainstorm: z.string().optional(),
	plan: z.string().optional(),
	implement: z.string().optional(),
	reviewTest: z.string().optional(),
	githubComment: z.string().optional(),
});

const mcpServerSchema = z.object({
	name: z.string().min(1),
	command: z.string().min(1),
	args: z.array(z.string()),
	env: z.record(z.string(), z.string()).optional(),
});

const runtimeConfigSchema = z.object({
	workspacePath: z.string().min(1),
	executionPath: z.string().min(1),
	codex: z.object({
		binary: z.string().min(1),
		streamLogs: z.boolean(),
		model: z.string().optional(),
		reasoningEffort: reasoningEffortSchema.optional(),
		models: stageConfigSchema.optional(),
		reasoningEfforts: z
			.object({
				brainstorm: reasoningEffortSchema.optional(),
				plan: reasoningEffortSchema.optional(),
				implement: reasoningEffortSchema.optional(),
				reviewTest: reasoningEffortSchema.optional(),
				githubComment: reasoningEffortSchema.optional(),
			})
			.optional(),
		fastModes: z
			.object({
				brainstorm: z.boolean().optional(),
				plan: z.boolean().optional(),
				implement: z.boolean().optional(),
				reviewTest: z.boolean().optional(),
				githubComment: z.boolean().optional(),
			})
			.optional(),
		plugins: z.array(z.string()).optional(),
		skillsets: z.array(z.string()).optional(),
		mcpServers: z.array(mcpServerSchema).optional(),
		configOverrides: z.record(z.string(), z.string()).optional(),
		sandbox: sandboxSchema.optional(),
		codexHome: z.string().optional(),
		docker: z.unknown().optional(),
	}),
	cursor: z
		.object({
			binary: z.string().min(1),
			streamLogs: z.boolean(),
			model: z.string().optional(),
			force: z.boolean().optional(),
			apiKey: z.string().optional(),
		})
		.optional(),
	opencode: z
		.object({
			binary: z.string().min(1),
			streamLogs: z.boolean(),
			model: z.string().optional(),
			agent: z.string().optional(),
			attach: z.string().optional(),
			dangerouslySkipPermissions: z.boolean().optional(),
		})
		.optional(),
	claude: z
		.object({
			model: z.string().optional(),
			maxTurns: z.number().optional(),
			allowedTools: z.array(z.string()).optional(),
			permissionMode: permissionModeSchema.optional(),
		})
		.optional(),
	agent: z
		.object({
			backend: backendSchema.optional(),
			model: z.string().optional(),
			maxTurns: z.number().optional(),
			allowedTools: z.array(z.string()).optional(),
			permissionMode: permissionModeSchema.optional(),
		})
		.optional(),
});

const agentDescriptorSchema = z.object({
	name: z.string(),
	instructions: z.string(),
	model: z.string().optional(),
	tools: z
		.array(z.object({ name: z.string(), description: z.string().optional() }))
		.optional(),
});

const skillReferenceSchema = z.object({
	name: z.string().optional(),
	path: z.string().optional(),
	content: z.string().optional(),
	source: z.string().optional(),
});

const runRequestSchema = z.object({
	role: z.enum([
		"brainstorm",
		"planning",
		"task-intake",
		"implementing",
		"review-testing",
		"github-comment",
	]),
	prompt: z.string(),
	sessionId: z.string().optional(),
	traceId: z.string().optional(),
	agent: agentDescriptorSchema.optional(),
	customInstructions: z.string().optional(),
	skills: z.array(skillReferenceSchema).optional(),
	skillsets: z.array(z.string()).optional(),
	onStream: z.function().optional(),
});

export function validateAgentAdapterRuntimeConfig(
	config: AgentAdapterRuntimeConfig,
): AgentAdapterRuntimeConfig {
	return parseOrThrow(
		runtimeConfigSchema,
		config,
		"Agent adapter runtime config validation failed",
	) as AgentAdapterRuntimeConfig;
}

export function validateAgentAdapterRunRequest(
	request: AgentAdapterRunRequest,
): AgentAdapterRunRequest {
	return parseOrThrow(
		runRequestSchema,
		request,
		"Agent adapter run request validation failed",
	) as AgentAdapterRunRequest;
}

function parseOrThrow<T>(
	schema: z.ZodType<T>,
	value: unknown,
	errorPrefix: string,
): T {
	const result = schema.safeParse(value);
	if (result.success) {
		return result.data;
	}
	throw new Error(`${errorPrefix}: ${formatZodIssues(result.error.issues)}`);
}

function formatZodIssues(issues: z.ZodIssue[]): string {
	return issues
		.map((issue) => {
			const path = issue.path.map(String).join(".");
			return path ? `${path}: ${issue.message}` : issue.message;
		})
		.join("; ");
}
