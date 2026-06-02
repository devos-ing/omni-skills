import {
	type AgentBackend,
	normalizeAgentBackend as normalizeKnownAgentBackend,
} from "adapters";
import type { CodexReasoningEffort, ResolvedProjectConfig } from "../types";

export function parseOptionalPositiveInt(
	value: string | undefined,
): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return undefined;
	}
	return parsed;
}

export function normalizeOptionalValue(
	input: string | undefined,
): string | undefined {
	if (!input) {
		return undefined;
	}
	const value = input.trim();
	return value ? value : undefined;
}

export function parseCommaList(
	input: string | undefined,
): string[] | undefined {
	if (!input || !input.trim()) {
		return undefined;
	}
	const items = input
		.split(",")
		.map((v) => v.trim())
		.filter(Boolean);
	return items.length > 0 ? items : undefined;
}

export function parseRecipientsFromEnv(input: string | undefined): string[] {
	if (!input) {
		return [];
	}
	return input
		.split(",")
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
}

export function normalizeSandboxValue(
	input: string | undefined,
): "read-only" | "workspace-write" | "danger-full-access" | undefined {
	if (!input) {
		return undefined;
	}
	const value = input.trim().toLowerCase();
	if (
		!value ||
		value === "off" ||
		value === "none" ||
		value === "0" ||
		value === "seatbelt"
	) {
		return undefined;
	}
	if (value === "read-only" || value === "workspace-write") {
		return value;
	}
	if (value === "danger-full-access") {
		return "danger-full-access";
	}
	throw new Error(
		`Invalid CODEX_SANDBOX value '${input}'. Use read-only, workspace-write, danger-full-access, or leave empty.`,
	);
}

export function normalizeReasoningEffortValue(
	input: string | undefined,
	envName: string,
): CodexReasoningEffort | undefined {
	if (!input) {
		return undefined;
	}
	const value = input.trim().toLowerCase();
	if (!value || value === "off" || value === "none" || value === "0") {
		return undefined;
	}
	if (
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	) {
		return value;
	}
	throw new Error(
		`Invalid ${envName} value '${input}'. Use low, medium, high, xhigh, or leave empty.`,
	);
}

export function normalizeBooleanEnvValue(
	input: string | undefined,
	envName: string,
): boolean | undefined {
	if (!input) {
		return undefined;
	}
	const value = input.trim().toLowerCase();
	if (!value || value === "off" || value === "none") {
		return undefined;
	}
	if (value === "1" || value === "true" || value === "yes" || value === "on") {
		return true;
	}
	if (value === "0" || value === "false" || value === "no") {
		return false;
	}
	throw new Error(
		`Invalid ${envName} value '${input}'. Use true/false, 1/0, yes/no, or leave empty.`,
	);
}

export function normalizeAgentBackend(
	value: string | undefined,
): AgentBackend | undefined {
	if (!value) {
		return undefined;
	}
	const backend = normalizeKnownAgentBackend(value);
	if (backend) {
		return backend;
	}
	throw new Error(
		`Invalid AGENT_BACKEND value: '${value}'. Must be 'codex', 'claude-code', 'github-copilot', 'cursor-agent', or 'opencode'.`,
	);
}

type ClaudePermissionMode = NonNullable<
	NonNullable<ResolvedProjectConfig["agent"]>["permissionMode"]
>;

const VALID_PERMISSION_MODES: readonly ClaudePermissionMode[] = [
	"default",
	"acceptEdits",
	"bypassPermissions",
	"dontAsk",
	"plan",
];

export function normalizePermissionMode(
	value: string | undefined,
): ClaudePermissionMode | undefined {
	if (!value) {
		return undefined;
	}
	const normalized = value.trim();
	if ((VALID_PERMISSION_MODES as readonly string[]).includes(normalized)) {
		return normalized as ClaudePermissionMode;
	}
	throw new Error(
		`Invalid CLAUDE_CODE_PERMISSION_MODE value: '${value}'. Must be one of: ${VALID_PERMISSION_MODES.join(", ")}.`,
	);
}
