import {
	Code2,
	Compass,
	Cpu,
	Database,
	FlaskConical,
	GitMerge,
	Lightbulb,
	ListTree,
	Send,
	ShieldCheck,
} from "lucide-react";

import type { FlowStage, FlowStep } from "@/components/redesign/redesign.types";

export const flowStages: FlowStage[] = [
	{ key: "explore", label: "EXPLORE", icon: Compass },
	{ key: "plan", label: "PLAN", icon: ListTree },
	{ key: "impl", label: "IMPL", icon: Code2 },
	{ key: "test", label: "TEST", icon: FlaskConical },
	{ key: "review", label: "REVIEW", icon: ShieldCheck },
];

export const flowSteps: FlowStep[] = [
	{
		icon: Lightbulb,
		title: "Drop the idea",
		body: "Devs and PMs file tasks or ideas directly on devos.ing - one line is enough.",
	},
	{
		icon: Database,
		title: "Daemon polls",
		body: "The devos daemon polls the shared task queue from the server DB on a tight loop.",
	},
	{
		icon: Cpu,
		title: "Pipeline runs",
		body: "Daemon dispatches agents through explore -> plan -> implement -> test -> review.",
	},
	{
		icon: Send,
		title: "Talk in Telegram",
		body: "Check status, approve, pause, or redirect - every notification is actionable.",
	},
	{
		icon: GitMerge,
		title: "Bot ships PR",
		body: "The GitHub bot reviews the diff and auto-merges when checks are green.",
	},
];
