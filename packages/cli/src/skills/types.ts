export type SkillSource = "folder" | "database";

export interface SkillCandidate {
	name: string;
	description?: string;
	content?: string;
	path?: string;
	tags: string[];
	source: SkillSource;
}

export interface RankedSkillCandidate extends SkillCandidate {
	score: number;
}

export interface SkillSelectionResult {
	selected: RankedSkillCandidate[];
	warnings: string[];
}

export interface SkillDocumentParts {
	title: string;
	description: string;
	content: string;
}

export type SkillDocumentFormat = "plain" | "frontmatter";

export interface ParsedSkillDocument extends SkillDocumentParts {
	format: SkillDocumentFormat;
}

export interface ListedSkill {
	name: string;
	path: string;
	title: string;
	description: string;
}
