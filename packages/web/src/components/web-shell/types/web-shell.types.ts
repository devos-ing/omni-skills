export type SidebarDisplayMode = "expanded" | "collapsed" | "hidden";

export type SidebarNavKey =
	| "chat"
	| "agents"
	| "runtimes"
	| "skills"
	| "settings"
	| "issues"
	| "projects"
	| "inbox"
	| "autopilot"
	| "squads"
	| "usage";

export interface SidebarNavItem {
	key: SidebarNavKey;
	label: string;
	href: `/${SidebarNavKey}`;
}

export interface OperatorSectionContent {
	description: string;
	heading: string;
}
