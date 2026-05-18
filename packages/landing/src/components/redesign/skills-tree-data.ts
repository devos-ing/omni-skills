import {
	Bell,
	BookOpen,
	Brain,
	Bug,
	Cpu,
	Database,
	FileSearch,
	FlaskConical,
	FolderGit2,
	GitPullRequest,
	Globe,
	MessageCircle,
	Search,
	Send,
	ShieldCheck,
	Terminal,
	TestTube2,
} from "lucide-react";

import type {
	AgentTag,
	SkillBranch,
} from "@/components/redesign/redesign.types";

export const agentColor: Record<AgentTag, string> = {
	SCOUT: "var(--neon-cyan)",
	ARCH: "var(--neon-pink)",
	FORGE: "var(--neon-cyan)",
	PROBE: "var(--neon-pink)",
	GATE: "var(--neon-cyan)",
};

export const skillBranches: SkillBranch[] = [
	{
		key: "repo",
		label: "REPO",
		icon: FolderGit2,
		accent: "pink",
		blurb: "Code-level skills",
		skills: [
			{
				key: "repo.edit",
				name: "repo.edit",
				icon: Terminal,
				description:
					"Patch files inside an isolated branch with format-on-save and lint checks.",
				agents: ["FORGE"],
				example: "edit('src/api.ts', diff)",
			},
			{
				key: "repo.read",
				name: "repo.read",
				icon: FileSearch,
				description:
					"Read files, symbol graphs, and git history without leaving the sandbox.",
				agents: ["SCOUT", "ARCH", "GATE"],
				example: "read('apps/web/**/*.tsx')",
			},
			{
				key: "pr.open",
				name: "pr.open",
				icon: GitPullRequest,
				description:
					"Open a PR with structured body, labels, and reviewers from your CODEOWNERS.",
				agents: ["FORGE", "GATE"],
				example: "pr.open({title, body})",
			},
		],
	},
	{
		key: "search",
		label: "SEARCH",
		icon: Search,
		accent: "cyan",
		blurb: "Pull grounded context",
		skills: [
			{
				key: "web.fetch",
				name: "web.fetch",
				icon: Globe,
				description:
					"Fetch and clean web pages with citations. Off by default; opt-in per agent.",
				agents: ["SCOUT"],
				example: "fetch('https://...')",
			},
			{
				key: "notion.query",
				name: "notion.query",
				icon: BookOpen,
				description:
					"Query Notion workspaces with semantic + keyword hybrid search.",
				agents: ["SCOUT", "ARCH"],
				example: "notion.query('onboarding')",
			},
			{
				key: "linear.search",
				name: "linear.search",
				icon: Bug,
				description:
					"Search Linear issues, recent activity, and assignees to find prior art.",
				agents: ["SCOUT"],
				example: "linear.search('flaky')",
			},
		],
	},
	{
		key: "memory",
		label: "MEMORY",
		icon: Brain,
		accent: "pink",
		blurb: "Persistent agent state",
		skills: [
			{
				key: "memory.read",
				name: "memory.read",
				icon: Database,
				description:
					"Recall previous plans, notes, and validated approaches across runs.",
				agents: ["SCOUT", "ARCH"],
				example: "memory.read('user/123')",
			},
			{
				key: "memory.write",
				name: "memory.write",
				icon: Brain,
				description:
					"Persist facts, decisions, and corrections so the crew doesn't repeat itself.",
				agents: ["SCOUT", "ARCH", "GATE"],
				example: "memory.write({fact})",
			},
		],
	},
	{
		key: "verify",
		label: "VERIFY",
		icon: FlaskConical,
		accent: "cyan",
		blurb: "Make the loop honest",
		skills: [
			{
				key: "tests.run",
				name: "tests.run",
				icon: TestTube2,
				description:
					"Run unit / integration / e2e suites in a sandbox; stream results in real time.",
				agents: ["PROBE"],
				example: "tests.run('--changed')",
			},
			{
				key: "policy.check",
				name: "policy.check",
				icon: ShieldCheck,
				description:
					"Apply policy rules: secrets, license, dependency risk, codeowner gates.",
				agents: ["GATE"],
				example: "policy.check(diff)",
			},
			{
				key: "browser.exec",
				name: "browser.exec",
				icon: Cpu,
				description:
					"Drive a headless browser to verify flows the test suite can't reach.",
				agents: ["PROBE"],
				example: "browser.exec(steps)",
			},
		],
	},
	{
		key: "comms",
		label: "COMMS",
		icon: MessageCircle,
		accent: "pink",
		blurb: "Talk to humans",
		skills: [
			{
				key: "telegram.notify",
				name: "telegram.notify",
				icon: Send,
				description:
					"Page the right human on Telegram with one-tap actions (approve / pause / retry).",
				agents: ["ARCH", "GATE"],
				example: "telegram.notify(user)",
			},
			{
				key: "pr.comment",
				name: "pr.comment",
				icon: GitPullRequest,
				description:
					"Post threaded review comments anchored to specific diff lines.",
				agents: ["GATE"],
				example: "pr.comment(line, body)",
			},
			{
				key: "alert.push",
				name: "alert.push",
				icon: Bell,
				description:
					"Escalate blockers to oncall via Pagerduty or your alert channel of choice.",
				agents: ["GATE"],
				example: "alert.push(severity)",
			},
		],
	},
];

export const allSkills = skillBranches.flatMap((branch) => branch.skills);
