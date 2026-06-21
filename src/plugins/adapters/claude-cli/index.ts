import { createWorkerCliAdapter } from "../factory";
import { claudeCliConfig } from "./utils";

export const claudeCliAdapter = createWorkerCliAdapter(claudeCliConfig);

export { buildClaudeGoalCommand } from "./commands";
export { runClaudeGoal, streamClaudeGoal } from "./helpers";
export { CLAUDE_CLI_EXECUTABLE, CLAUDE_GOAL_COMMAND, claudeCliConfig } from "./utils";
