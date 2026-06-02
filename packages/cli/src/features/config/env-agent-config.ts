import type { ProjectRuntimeConfig } from "../types";
import {
	normalizeAgentBackend,
	normalizeBooleanEnvValue,
	normalizeOptionalValue,
	normalizePermissionMode,
	parseCommaList,
	parseOptionalPositiveInt,
} from "./env-normalizers";

type Env = Record<string, string | undefined>;

export function buildEnvAgentConfig(
	env: Env,
	streamLogs: boolean,
): Pick<
	ProjectRuntimeConfig,
	"agent" | "claude" | "cursor" | "githubCopilot" | "opencode"
> {
	return {
		cursor: {
			binary: normalizeOptionalValue(env.CURSOR_AGENT_BINARY) ?? "cursor-agent",
			streamLogs,
			model: normalizeOptionalValue(env.CURSOR_AGENT_MODEL),
			force: normalizeBooleanEnvValue(
				env.CURSOR_AGENT_FORCE,
				"CURSOR_AGENT_FORCE",
			),
			apiKey: normalizeOptionalValue(env.CURSOR_API_KEY),
		},
		opencode: {
			binary: normalizeOptionalValue(env.OPENCODE_BINARY) ?? "opencode",
			streamLogs,
			model: normalizeOptionalValue(env.OPENCODE_MODEL),
			agent: normalizeOptionalValue(env.OPENCODE_AGENT),
			attach: normalizeOptionalValue(env.OPENCODE_ATTACH),
			dangerouslySkipPermissions: normalizeBooleanEnvValue(
				env.OPENCODE_DANGEROUSLY_SKIP_PERMISSIONS,
				"OPENCODE_DANGEROUSLY_SKIP_PERMISSIONS",
			),
		},
		githubCopilot: {
			binary: normalizeOptionalValue(env.GITHUB_COPILOT_BINARY) ?? "copilot",
			streamLogs,
			model: normalizeOptionalValue(env.GITHUB_COPILOT_MODEL),
			copilotHome: normalizeOptionalValue(env.GITHUB_COPILOT_HOME),
			githubToken: normalizeOptionalValue(env.GITHUB_COPILOT_TOKEN),
			allowAllTools: normalizeBooleanEnvValue(
				env.GITHUB_COPILOT_ALLOW_ALL_TOOLS,
				"GITHUB_COPILOT_ALLOW_ALL_TOOLS",
			),
			allowTools: parseCommaList(env.GITHUB_COPILOT_ALLOW_TOOLS),
			denyTools: parseCommaList(env.GITHUB_COPILOT_DENY_TOOLS),
		},
		agent: {
			backend: normalizeAgentBackend(env.AGENT_BACKEND),
		},
		claude: {
			model: normalizeOptionalValue(env.CLAUDE_CODE_MODEL),
			maxTurns: parseOptionalPositiveInt(env.CLAUDE_CODE_MAX_TURNS),
			allowedTools: parseCommaList(env.CLAUDE_CODE_ALLOWED_TOOLS),
			permissionMode: normalizePermissionMode(env.CLAUDE_CODE_PERMISSION_MODE),
		},
	};
}
