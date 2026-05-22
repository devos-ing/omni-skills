import type { RankedSkillCandidate } from "./types";

export interface PlanPromptOptions {
	supplementalSkills?: RankedSkillCandidate[];
	autoSelectWarnings?: string[];
}

export interface ReviewPromptOptions {
	successGoal?: string;
	planSummary?: string;
}
