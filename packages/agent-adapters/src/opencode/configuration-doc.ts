import type { AgentConfigurationDoc } from "../types/agent-registry.types";
import {
	OPENCODE_AVAILABLE_MODELS,
	OPENCODE_BACKEND,
	OPENCODE_DEFAULT_MODEL,
	OPENCODE_DESCRIPTION,
	OPENCODE_LABEL,
} from "./constants";

export const opencodeConfigurationDoc = {
	backend: OPENCODE_BACKEND,
	label: OPENCODE_LABEL,
	description: OPENCODE_DESCRIPTION,
	env: [
		field("AGENT_BACKEND", "Agent backend", "Use 'opencode' for OpenCode."),
		field("OPENCODE_BINARY", "Binary", "OpenCode CLI binary path."),
		field(
			"OPENCODE_MODEL",
			"Model",
			"OpenCode model id, such as ollama/qwen2.5-coder:32b.",
		),
		field("OPENCODE_AGENT", "Agent", "Optional OpenCode agent name."),
		field("OPENCODE_ATTACH", "Attach URL", "Optional OpenCode server URL."),
		field(
			"OPENCODE_DANGEROUSLY_SKIP_PERMISSIONS",
			"Skip permissions",
			"Allow OpenCode to skip permission prompts.",
		),
	],
	configFields: [
		field("agent.backend", "Agent backend", "Project agent backend."),
		field("opencode.binary", "Binary", "OpenCode CLI binary path."),
		field("opencode.model", "Model", "OpenCode model id."),
		field("opencode.agent", "Agent", "Optional OpenCode agent name."),
		field("opencode.attach", "Attach URL", "Optional OpenCode server URL."),
		field(
			"opencode.dangerouslySkipPermissions",
			"Skip permissions",
			"Allow OpenCode to skip permission prompts.",
		),
	],
	defaults: {
		backend: OPENCODE_BACKEND,
		model: OPENCODE_DEFAULT_MODEL,
	},
	availableModels: OPENCODE_AVAILABLE_MODELS,
} satisfies AgentConfigurationDoc;

function field(
	name: string,
	label: string,
	description: string,
): AgentConfigurationDoc["env"][number] {
	return { name, label, description };
}
