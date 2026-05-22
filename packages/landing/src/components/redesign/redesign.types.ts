import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type AgentKey =
	| "planner"
	| "researcher"
	| "coder"
	| "reviewer"
	| "deployer";

export type AgentLine = {
	tag: AgentKey | "you";
	text: ReactNode;
};

export type AgentProfile = {
	name: AgentKey;
	role: string;
	icon: LucideIcon;
	color: string;
	dot?: string;
	tools: string[];
	command: string;
	lines: AgentLine[];
	metrics: Array<{ label: string; value: string }>;
};

export type FlowStage = {
	key: string;
	label: string;
	icon: LucideIcon;
};

export type FlowStep = {
	icon: LucideIcon;
	title: string;
	body: string;
};

export type BoardStatus =
	| "backlog"
	| "exploring"
	| "planning"
	| "implementing"
	| "testing"
	| "done";

export type BoardColumn = {
	key: BoardStatus;
	title: string;
	tint: string;
};

export type BoardTask = {
	id: string;
	title: string;
	status: BoardStatus;
	agent: string;
	meta?: string;
};

export type ChatMessage = {
	from: "bot" | "you";
	time: string;
	body: ReactNode;
	read?: boolean;
	typingMs?: number;
	delayMs?: number;
};

export type CrewTone = "pink" | "cyan";

export type CrewBot = {
	key: string;
	name: string;
	role: string;
	tagline: string;
	body: string;
	badge: string;
	icon: LucideIcon;
	face: CrewTone;
	visor: CrewTone;
	stats: Array<{ label: string; value: string }>;
};

export type CornerPosition = "tl" | "tr" | "bl" | "br";

export type PixelBotProps = {
	face: CrewTone;
	visor: CrewTone;
	variant: number;
	small?: boolean;
};

export type AgentTag = "SCOUT" | "ARCH" | "FORGE" | "PROBE" | "GATE";

export type Skill = {
	key: string;
	name: string;
	icon: LucideIcon;
	description: string;
	agents: AgentTag[];
	example: string;
};

export type SkillBranch = {
	key: string;
	label: string;
	icon: LucideIcon;
	accent: CrewTone;
	blurb: string;
	skills: Skill[];
};
