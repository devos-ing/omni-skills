import type {
	DevosPluginManifest,
	DevosPluginMcpServer,
} from "create-devos-plugin";

export interface InstalledDevosPluginSkill {
	name: string;
	path: string;
	description?: string;
}

export interface InstalledDevosPlugin {
	id: string;
	sourcePath: string;
	enabled: boolean;
	manifest: DevosPluginManifest;
	credentials: Record<string, string>;
	skills: InstalledDevosPluginSkill[];
	mcpServers: DevosPluginMcpServer[];
}

export interface InstancePluginsConfig {
	installed: InstalledDevosPlugin[];
}

export interface OnboardWorkspaceConfig {
	id: string;
	name: string;
}

export type OnboardModelStage =
	| "brainstorm"
	| "githubComment"
	| "implement"
	| "plan"
	| "reviewTest";

export type OnboardReasoningEffort = "high" | "low" | "medium" | "xhigh";

export interface OnboardCodexConfig {
	models?: Partial<Record<OnboardModelStage, string>>;
	reasoningEfforts?: Partial<Record<OnboardModelStage, OnboardReasoningEffort>>;
}

export interface OnboardInstanceConfig {
	$meta: {
		version: 1;
		updatedAt: string;
		source: "onboard";
	};
	workspace: OnboardWorkspaceConfig;
	database: {
		mode: "embedded-postgres";
		embeddedPostgresDataDir: string;
		embeddedPostgresPort: number;
		backup: {
			enabled: boolean;
			intervalMinutes: number;
			retentionDays: number;
			dir: string;
		};
	};
	logging: {
		mode: "file";
		logDir: string;
	};
	server: {
		deploymentMode: "local_trusted";
		exposure: "private";
		bind: "loopback";
		host: "127.0.0.1";
		port: number;
		allowedHostnames: string[];
		serveUi: boolean;
	};
	auth: {
		baseUrlMode: "auto";
		disableSignUp: boolean;
	};
	telemetry: {
		enabled: boolean;
	};
	storage: {
		provider: "local_disk";
		localDisk: {
			baseDir: string;
		};
		s3: {
			bucket: string;
			region: string;
			prefix: string;
			forcePathStyle: boolean;
		};
	};
	secrets: {
		provider: "local_encrypted";
		strictMode: boolean;
		localEncrypted: {
			keyFilePath: string;
		};
	};
	codex?: OnboardCodexConfig;
	plugins?: InstancePluginsConfig;
}

export type InstanceConfigLoadResult =
	| { ok: true; config: OnboardInstanceConfig }
	| { ok: false; message: string };
