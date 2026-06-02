import type {
	DeepPartial,
	ProjectConfig,
	ProjectRuntimeConfig,
} from "../types";

type AgentConfig = Pick<
	ProjectRuntimeConfig,
	"agent" | "claude" | "cursor" | "githubCopilot" | "opencode"
>;

export function resolveProjectAgentConfig(
	base: ProjectRuntimeConfig,
	rootDefaults: DeepPartial<ProjectRuntimeConfig>,
	project: ProjectConfig,
): AgentConfig {
	return {
		cursor: {
			binary:
				project.cursor?.binary ??
				rootDefaults.cursor?.binary ??
				base.cursor?.binary ??
				"cursor-agent",
			streamLogs:
				project.cursor?.streamLogs ??
				rootDefaults.cursor?.streamLogs ??
				base.cursor?.streamLogs ??
				base.codex.streamLogs,
			model:
				project.cursor?.model ??
				rootDefaults.cursor?.model ??
				base.cursor?.model,
			force:
				project.cursor?.force ??
				rootDefaults.cursor?.force ??
				base.cursor?.force,
			apiKey:
				project.cursor?.apiKey ??
				rootDefaults.cursor?.apiKey ??
				base.cursor?.apiKey,
		},
		opencode: {
			binary:
				project.opencode?.binary ??
				rootDefaults.opencode?.binary ??
				base.opencode?.binary ??
				"opencode",
			streamLogs:
				project.opencode?.streamLogs ??
				rootDefaults.opencode?.streamLogs ??
				base.opencode?.streamLogs ??
				base.codex.streamLogs,
			model:
				project.opencode?.model ??
				rootDefaults.opencode?.model ??
				base.opencode?.model,
			agent:
				project.opencode?.agent ??
				rootDefaults.opencode?.agent ??
				base.opencode?.agent,
			attach:
				project.opencode?.attach ??
				rootDefaults.opencode?.attach ??
				base.opencode?.attach,
			dangerouslySkipPermissions:
				project.opencode?.dangerouslySkipPermissions ??
				rootDefaults.opencode?.dangerouslySkipPermissions ??
				base.opencode?.dangerouslySkipPermissions,
		},
		githubCopilot: {
			binary:
				project.githubCopilot?.binary ??
				rootDefaults.githubCopilot?.binary ??
				base.githubCopilot?.binary ??
				"copilot",
			streamLogs:
				project.githubCopilot?.streamLogs ??
				rootDefaults.githubCopilot?.streamLogs ??
				base.githubCopilot?.streamLogs ??
				base.codex.streamLogs,
			model:
				project.githubCopilot?.model ??
				rootDefaults.githubCopilot?.model ??
				base.githubCopilot?.model,
			copilotHome:
				project.githubCopilot?.copilotHome ??
				rootDefaults.githubCopilot?.copilotHome ??
				base.githubCopilot?.copilotHome,
			githubToken:
				project.githubCopilot?.githubToken ??
				rootDefaults.githubCopilot?.githubToken ??
				base.githubCopilot?.githubToken,
			allowAllTools:
				project.githubCopilot?.allowAllTools ??
				rootDefaults.githubCopilot?.allowAllTools ??
				base.githubCopilot?.allowAllTools,
			allowTools:
				project.githubCopilot?.allowTools ??
				rootDefaults.githubCopilot?.allowTools ??
				base.githubCopilot?.allowTools,
			denyTools:
				project.githubCopilot?.denyTools ??
				rootDefaults.githubCopilot?.denyTools ??
				base.githubCopilot?.denyTools,
		},
		claude: {
			...(base.claude ?? {}),
			...(rootDefaults.claude ?? {}),
			...(project.claude ?? {}),
		},
		agent: {
			...base.agent,
			...(rootDefaults.agent ?? {}),
			...(project.agent ?? {}),
		},
	};
}
