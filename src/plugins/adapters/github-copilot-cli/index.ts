import { createWorkerCliAdapter } from "../factory";
import { githubCopilotCliConfig } from "./utils";

export const githubCopilotCliAdapter = createWorkerCliAdapter(githubCopilotCliConfig);

export { buildGithubCopilotGoalCommand } from "./commands";
export { runGithubCopilotGoal, streamGithubCopilotGoal } from "./helpers";
export {
  GITHUB_COPILOT_BASE_ARGS,
  GITHUB_COPILOT_CLI_EXECUTABLE,
  GITHUB_COPILOT_GOAL_PREFIX,
  githubCopilotCliConfig,
} from "./utils";
