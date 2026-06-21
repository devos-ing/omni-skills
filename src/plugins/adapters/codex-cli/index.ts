import { createWorkerCliAdapter } from "../factory";
import { codexCliConfig } from "./utils";

export const codexCliAdapter = createWorkerCliAdapter(codexCliConfig);

export { buildCodexGoalCommand } from "./commands";
export { runCodexGoal, streamCodexGoal } from "./helpers";
export {
  CODEX_CLI_EXECUTABLE,
  CODEX_EXEC_BASE_ARGS,
  CODEX_GOAL_PREFIX,
  codexCliConfig,
} from "./utils";
