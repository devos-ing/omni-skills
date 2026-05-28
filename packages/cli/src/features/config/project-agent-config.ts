import type {
	DeepPartial,
	ProjectConfig,
	ProjectRuntimeConfig,
} from "../types";

type AgentConfig = Pick<
	ProjectRuntimeConfig,
	"agent" | "claude" | "cursor" | "opencode"
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
