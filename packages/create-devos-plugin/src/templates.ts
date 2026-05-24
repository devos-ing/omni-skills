import type {
	DevosPluginCheck,
	DevosPluginCredential,
	DevosPluginManifest,
	DevosPluginMcpServer,
	DevosPluginSkill,
} from "./plugin-manifest.types";
import type { DevosPluginPreset, DevosPluginTemplate } from "./scaffold.types";

interface TemplateInput {
	pluginId: string;
	displayName: string;
	description: string;
	author: string;
	template: DevosPluginTemplate;
	preset?: DevosPluginPreset;
}

export function buildManifest(input: TemplateInput): DevosPluginManifest {
	return {
		schemaVersion: 1,
		id: input.pluginId,
		name: input.displayName,
		version: "0.1.0",
		description: input.description,
		category: categoryFor(input),
		skills: [skillFor(input)],
		mcpServers: mcpServersFor(input),
		credentials: credentialsFor(input),
		checks: checksFor(input),
	};
}

export function renderPackageJson(input: TemplateInput): string {
	return renderJson({
		name: input.pluginId,
		version: "0.1.0",
		type: "module",
		private: true,
		scripts: {
			build: "bun build ./src/worker.ts --outdir dist --target bun",
			dev: "bun run ./src/worker.ts",
			test: "bun test tests",
			typecheck: "bunx tsc --noEmit",
		},
		devDependencies: {
			"@types/bun": "^1.3.2",
			typescript: "^5.9.3",
		},
		devosPlugin: {
			manifest: "./devos.plugin.json",
			author: input.author,
		},
	});
}

export function renderReadme(input: TemplateInput): string {
	return [
		`# ${input.displayName}`,
		"",
		input.description,
		"",
		"## Develop",
		"",
		"```bash",
		"bun install",
		"bun test",
		"bun run build",
		"devos plugins install .",
		`devos plugins enable ${input.pluginId}`,
		"```",
		"",
		"## Files",
		"",
		"- `devos.plugin.json` declares skills, MCP servers, credentials, and checks.",
		"- `skills/` contains agent-facing instructions.",
		"- `src/worker.ts` is the plugin runtime entrypoint.",
	].join("\n");
}

export function renderWorker(input: TemplateInput): string {
	const credentialKeys = credentialsFor(input).map((item) => item.key);
	return [
		'import type { DevosPluginWorkerContext } from "./worker.types";',
		"",
		"export async function run(context: DevosPluginWorkerContext): Promise<void> {",
		`	context.logger.info("${input.pluginId} plugin worker started");`,
		...credentialKeys.map(
			(key) =>
				`	if (!context.credentials.${key}) context.logger.warn("${key} is not configured");`,
		),
		"}",
		"",
		"if (import.meta.main) {",
		"	await run({",
		"		credentials: process.env as Record<string, string | undefined>,",
		"		logger: console,",
		"	});",
		"}",
	].join("\n");
}

export function renderWorkerTypes(): string {
	return [
		"export interface DevosPluginWorkerContext {",
		"	credentials: Record<string, string | undefined>;",
		'	logger: Pick<Console, "info" | "warn" | "error">;',
		"}",
	].join("\n");
}

export function renderSkill(input: TemplateInput): string {
	return [
		"---",
		`name: ${input.pluginId}`,
		`description: ${input.description}`,
		"---",
		"",
		`# ${input.displayName}`,
		"",
		`Use this skill when a task needs the ${input.displayName} plugin.`,
		"",
		"- Prefer structured plugin commands and declared MCP tools when available.",
		"- Keep secrets out of prompts and logs.",
		"- Report missing plugin credentials as setup blockers.",
	].join("\n");
}

export function renderWorkerTest(input: TemplateInput): string {
	return [
		'import { describe, expect, it } from "bun:test";',
		'import { run } from "../src/worker";',
		"",
		`describe("${input.pluginId} worker", () => {`,
		'	it("starts with the devos worker context", async () => {',
		"		const messages: string[] = [];",
		"		await run({",
		"			credentials: {},",
		"			logger: {",
		"				info: (message) => messages.push(String(message)),",
		"				warn: () => undefined,",
		"				error: () => undefined,",
		"			},",
		"		});",
		`		expect(messages).toContain("${input.pluginId} plugin worker started");`,
		"	});",
		"});",
	].join("\n");
}

export function renderMcpConfig(manifest: DevosPluginManifest): string {
	const servers = Object.fromEntries(
		manifest.mcpServers.map((server) => [
			server.name,
			{
				command: server.command,
				args: server.args,
				...(server.env ? { env: server.env } : {}),
			},
		]),
	);
	return renderJson({ mcpServers: servers });
}

function skillFor(input: TemplateInput): DevosPluginSkill {
	return {
		name: input.pluginId,
		path: `skills/${input.pluginId}/SKILL.md`,
		description: input.description,
	};
}

function mcpServersFor(input: TemplateInput): DevosPluginMcpServer[] {
	if (input.preset === "codegraph") {
		return [
			{ name: "codegraph", command: "codegraph", args: ["serve", "--mcp"] },
		];
	}
	if (input.template !== "mcp") return [];
	return [
		{ name: input.pluginId, command: "bun", args: ["run", "src/worker.ts"] },
	];
}

function credentialsFor(input: TemplateInput): DevosPluginCredential[] {
	if (input.preset === "slack")
		return [credential("SLACK_BOT_TOKEN", "Slack bot token")];
	if (input.preset === "telegram") {
		return [credential("TELEGRAM_BOT_TOKEN", "Telegram bot token")];
	}
	return [];
}

function credential(key: string, label: string): DevosPluginCredential {
	return { key, label, required: true, prompt: `Enter ${label}` };
}

function checksFor(input: TemplateInput): DevosPluginCheck[] {
	if (input.preset === "codegraph") {
		return [
			{
				title: "Verify CodeGraph is available",
				command: "codegraph",
				args: ["--version"],
			},
		];
	}
	return [{ title: "Run plugin tests", command: "bun", args: ["test"] }];
}

function categoryFor(input: TemplateInput): string {
	if (input.template === "mcp") return "Developer Tools";
	if (input.template === "connector") return "Connector";
	return "Skill";
}

function renderJson(value: unknown): string {
	return `${JSON.stringify(value, null, "\t")}\n`;
}
