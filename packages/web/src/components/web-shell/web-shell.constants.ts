import type {
	OperatorSectionContent,
	SidebarNavItem,
	SidebarNavKey,
} from "@/components/web-shell/types/web-shell.types";

export const navItems: SidebarNavItem[] = [
	{ key: "agents", label: "Agents", href: "/agents" },
	{ key: "projects", label: "Projects", href: "/projects" },
	{ key: "integrations", label: "Integrations", href: "/integrations" },
	{ key: "git", label: "Git", href: "/git" },
	{ key: "usage", label: "Usage", href: "/usage" },
	{ key: "runtimes", label: "Runtimes", href: "/runtimes" },
];

export const sectionContentByKey: Record<
	SidebarNavKey,
	OperatorSectionContent
> = {
	agents: {
		heading: "Agents Job Board",
		description: "Monitor active agent health and workflow state.",
	},
	runtimes: {
		heading: "Runtimes Job Board",
		description: "Track runtime readiness and job execution surfaces.",
	},
	skills: {
		heading: "Skills Job Board",
		description: "Manage skill coverage needed for task execution.",
	},
	settings: {
		heading: "Settings Job Board",
		description: "Review operator-level defaults and preferences.",
	},
	git: {
		heading: "Git Instructions",
		description: "Customize commit and pull request instructions.",
	},
	issues: {
		heading: "Issues Job Board",
		description: "Inspect issue queue and active implementation flow.",
	},
	projects: {
		heading: "Projects Job Board",
		description: "Coordinate project-level work streams and status.",
	},
	integrations: {
		heading: "Integrations",
		description: "Connect external services for this workspace.",
	},
	inbox: {
		heading: "Inbox Job Board",
		description: "Handle incoming task requests and clarifications.",
	},
	autopilot: {
		heading: "Autopilot Job Board",
		description: "Observe automation status and intervention needs.",
	},
	squads: {
		heading: "Squads Job Board",
		description: "Coordinate grouped agents and ownership boundaries.",
	},
	usage: {
		heading: "Usage Job Board",
		description: "Inspect workflow usage and operating volume.",
	},
	chat: {
		heading: "Chat",
		description: "Create tasks and run workflow commands.",
	},
};

export function hrefForNavKey(key: SidebarNavKey): SidebarNavItem["href"] {
	return navItems.find((item) => item.key === key)?.href ?? "/chat";
}
