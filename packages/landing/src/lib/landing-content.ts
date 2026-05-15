export const repositoryUrl = "https://github.com/1997roylee/show-me-ur-agents";
export const readmeUrl =
	"https://github.com/1997roylee/show-me-ur-agents#readme";

export const navItems = [
	{ href: "#start", label: "Start" },
	{ href: "#how", label: "How it works" },
	{ href: "#features", label: "Features" },
	{ href: "#faq", label: "FAQ" },
];

export const runCommand = {
	kicker: "Get started",
	title: "Run the command, then connect your first workflow.",
	body: "Interactive setup walks through configuration and checks your local environment before the first agent run.",
	command: "npx devos setup",
};

export const workflowFlow = [
	"Route",
	"Explore",
	"Plan",
	"Build",
	"Review",
	"Loop",
];

export const features = [
	{
		title: "Project routing",
		body: "Send each issue to the right repo and workspace.",
	},
	{
		title: "Linear sync",
		body: "Keep status, labels, and comments aligned.",
	},
	{
		title: "PR context",
		body: "Carry review feedback back into the run.",
	},
	{
		title: "Stable review",
		body: "Parse RESULT, SUMMARY, and BUGS_JSON.",
	},
	{
		title: "Scheduled sweeps",
		body: "Run one issue or sweep eligible queues.",
	},
	{
		title: "Operator control",
		body: "Inspect stage, outcome, and risk.",
	},
];

export const faqs = [
	{
		question: "What is devos.ing?",
		answer:
			"An agentic development hub for routing Linear issues through planning, build, review, and verification.",
	},
	{
		question: "Does it replace engineers?",
		answer:
			"No. It handles repeatable workflow loops while engineers keep control of scope, review, and outcomes.",
	},
	{
		question: "Which tools does it work with?",
		answer:
			"Linear, GitHub pull requests, CLI execution, server cron, Codex, and Claude Code.",
	},
	{
		question: "Can it run unattended?",
		answer:
			"Yes. Run one scoped issue, poll locally, or let server automation sweep configured projects.",
	},
];

export const footerGroups = [
	{
		title: "Product",
		links: [
			{ href: "#how", label: "How it works" },
			{ href: "#features", label: "Features" },
			{ href: "#faq", label: "FAQ" },
		],
	},
	{
		title: "Docs",
		links: [
			{
				href: "https://github.com/1997roylee/show-me-ur-agents/blob/main/docs/PLANS.md",
				label: "Plans",
			},
			{
				href: "https://github.com/1997roylee/show-me-ur-agents/blob/main/docs/RELIABILITY.md",
				label: "Reliability",
			},
			{
				href: "https://github.com/1997roylee/show-me-ur-agents/blob/main/docs/SECURITY.md",
				label: "Security",
			},
		],
	},
	{
		title: "Start",
		links: [
			{ href: readmeUrl, label: "Quick start" },
			{
				href: "https://github.com/1997roylee/show-me-ur-agents/blob/main/ARCHITECTURE.md",
				label: "Architecture",
			},
			{
				href: repositoryUrl,
				label: "GitHub",
			},
		],
	},
];
