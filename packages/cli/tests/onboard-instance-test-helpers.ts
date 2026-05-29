import path from "node:path";
import {
	DEFAULT_LABEL_MAP,
	DEFAULT_REASONING_EFFORTS,
	DEFAULT_STATUS_MAP,
	type OnboardDraft,
	createDefaultOnboardInstanceDraft,
} from "../src/features/onboard";
import type {
	PromptAdapter,
	SelectPromptOptions,
} from "../src/features/prompts";

export function baseOnboardDraft(): OnboardDraft {
	return {
		workspaceName: "Demo Workspace",
		workspacePath: "/tmp/demo",
		executionPath: "/tmp/demo",
		instance: createDefaultOnboardInstanceDraft(),
		notifications: { email: { enabled: false, to: [] } },
		workflow: { isolatedWorktrees: true },
		statusMap: DEFAULT_STATUS_MAP,
		labelMap: DEFAULT_LABEL_MAP,
		codex: {
			reasoningEfforts: {
				brainstorm: DEFAULT_REASONING_EFFORTS.brainstorm,
				plan: DEFAULT_REASONING_EFFORTS.plan,
				implement: DEFAULT_REASONING_EFFORTS.implement,
				reviewTest: DEFAULT_REASONING_EFFORTS.reviewTest,
				githubComment: DEFAULT_REASONING_EFFORTS.reviewTest,
			},
			models: {
				brainstorm: "gpt-5.5",
				plan: "gpt-5.5",
				implement: "gpt-5.3-codex",
				reviewTest: "gpt-5.3-codex",
				githubComment: "gpt-5.3-codex",
			},
			plugins: ["github@openai-curated"],
			skillsets: ["devos"],
			configOverrides: { "features.codex_hooks": "true" },
			sandbox: "workspace-write",
		},
	};
}

export function customInstanceDraft(root: string): OnboardDraft["instance"] {
	return {
		database: {
			embeddedPostgresDataDir: path.join(root, "postgres"),
			embeddedPostgresPort: 55432,
			backup: {
				enabled: false,
				intervalMinutes: 30,
				retentionDays: 14,
				dir: path.join(root, "backups"),
			},
		},
		logging: { logDir: path.join(root, "logs") },
		server: {
			port: 4200,
			allowedHostnames: ["devos.local"],
			serveUi: false,
		},
		auth: { disableSignUp: true },
		telemetry: { enabled: false },
		storage: {
			localDiskBaseDir: path.join(root, "storage"),
			s3: {
				bucket: "devos-artifacts",
				region: "us-west-2",
				prefix: "prod/",
				forcePathStyle: true,
			},
		},
		secrets: {
			strictMode: true,
			keyFilePath: path.join(root, "secrets", "master.key"),
		},
	};
}

export function promptAdapter(values: {
	text?: Record<string, string>;
	password?: Record<string, string>;
	confirm?: Record<string, boolean>;
	select?: Record<string, string>;
}): PromptAdapter {
	return {
		text: async ({ message, defaultValue }) =>
			values.text?.[message] ?? defaultValue ?? "",
		password: async ({ message }) => values.password?.[message] ?? "",
		confirm: async ({ message, initialValue }) =>
			values.confirm?.[message] ?? initialValue ?? false,
		select: async <Value extends string>({
			message,
			options,
			initialValue,
		}: SelectPromptOptions<Value>) =>
			options.find((option) => option.value === values.select?.[message])
				?.value ??
			initialValue ??
			options[0]?.value ??
			("" as Value),
	};
}
