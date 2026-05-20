import type { AgentConfigurationDoc } from "../agent-registry.types";
import {
	CURSOR_AVAILABLE_MODELS,
	CURSOR_BACKEND,
	CURSOR_DEFAULT_MODEL,
	CURSOR_DESCRIPTION,
	CURSOR_LABEL,
} from "./constants";

export const cursorConfigurationDoc = {
	backend: CURSOR_BACKEND,
	label: CURSOR_LABEL,
	description: CURSOR_DESCRIPTION,
	env: [
		field(
			"AGENT_BACKEND",
			"Agent backend",
			"Use 'cursor-agent' for Cursor Agent.",
		),
		field("CURSOR_AGENT_BINARY", "Binary", "Cursor Agent CLI binary path."),
		field("CURSOR_AGENT_MODEL", "Model", "Cursor Agent model id."),
		field("CURSOR_AGENT_FORCE", "Force", "Allow Cursor Agent commands."),
		field("CURSOR_API_KEY", "API key", "Cursor API key."),
	],
	configFields: [
		field("agent.backend", "Agent backend", "Project agent backend."),
		field("cursor.binary", "Binary", "Cursor Agent CLI binary path."),
		field("cursor.model", "Model", "Cursor Agent model id."),
		field("cursor.force", "Force", "Allow Cursor Agent commands."),
		field("cursor.apiKey", "API key", "Cursor API key."),
	],
	defaults: {
		backend: CURSOR_BACKEND,
		model: CURSOR_DEFAULT_MODEL,
	},
	availableModels: CURSOR_AVAILABLE_MODELS,
} satisfies AgentConfigurationDoc;

function field(
	name: string,
	label: string,
	description: string,
): AgentConfigurationDoc["env"][number] {
	return { name, label, description };
}
