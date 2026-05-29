import type { BrainstormPromptOptions } from "../../features/workflow/types/brainstorm.types";
import type { RankedSkillCandidate } from "./";

export type { BrainstormPromptOptions };

export interface PlanPromptOptions {
	supplementalSkills?: RankedSkillCandidate[];
	autoSelectWarnings?: string[];
	brainstormSummary?: string;
}

export interface ReviewPromptOptions {
	successGoal?: string;
	planSummary?: string;
}
