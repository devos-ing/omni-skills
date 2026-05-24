import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
	DevosPluginCheck,
	DevosPluginCredential,
	DevosPluginManifest,
	DevosPluginMcpServer,
	DevosPluginSkill,
} from "./plugin-manifest.types";

const MANIFEST_FILE = "devos.plugin.json";

export async function loadDevosPluginManifest(
	pluginPath: string,
): Promise<DevosPluginManifest> {
	const manifestPath = path.join(pluginPath, MANIFEST_FILE);
	const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
	return parseDevosPluginManifest(parsed, manifestPath);
}

export function parseDevosPluginManifest(
	input: unknown,
	sourceLabel = MANIFEST_FILE,
): DevosPluginManifest {
	const record = requireRecord(input, sourceLabel);
	const manifest: DevosPluginManifest = {
		schemaVersion: requireOne(
			record.schemaVersion,
			`${sourceLabel}.schemaVersion`,
		),
		id: requireId(record.id, `${sourceLabel}.id`),
		name: requireString(record.name, `${sourceLabel}.name`),
		version: requireSemver(record.version, `${sourceLabel}.version`),
		description: requireString(
			record.description,
			`${sourceLabel}.description`,
		),
		category: requireString(record.category, `${sourceLabel}.category`),
		skills: requireArray(record.skills, `${sourceLabel}.skills`).map(
			(item, index) => parseSkill(item, `${sourceLabel}.skills[${index}]`),
		),
		mcpServers: requireArray(
			record.mcpServers,
			`${sourceLabel}.mcpServers`,
		).map((item, index) =>
			parseMcpServer(item, `${sourceLabel}.mcpServers[${index}]`),
		),
		credentials: requireArray(
			record.credentials,
			`${sourceLabel}.credentials`,
		).map((item, index) =>
			parseCredential(item, `${sourceLabel}.credentials[${index}]`),
		),
		checks: requireArray(record.checks, `${sourceLabel}.checks`).map(
			(item, index) => parseCheck(item, `${sourceLabel}.checks[${index}]`),
		),
	};
	return manifest;
}

function parseSkill(input: unknown, label: string): DevosPluginSkill {
	const record = requireRecord(input, label);
	return {
		name: requireId(record.name, `${label}.name`),
		path: requireRelativePath(record.path, `${label}.path`),
		description: optionalString(record.description, `${label}.description`),
	};
}

function parseMcpServer(input: unknown, label: string): DevosPluginMcpServer {
	const record = requireRecord(input, label);
	return {
		name: requireId(record.name, `${label}.name`),
		command: requireString(record.command, `${label}.command`),
		args: requireStringArray(record.args, `${label}.args`),
		env: parseOptionalStringRecord(record.env, `${label}.env`),
	};
}

function parseCredential(input: unknown, label: string): DevosPluginCredential {
	const record = requireRecord(input, label);
	return {
		key: requireEnvKey(record.key, `${label}.key`),
		label: requireString(record.label, `${label}.label`),
		required: requireBoolean(record.required, `${label}.required`),
		prompt: requireString(record.prompt, `${label}.prompt`),
	};
}

function parseCheck(input: unknown, label: string): DevosPluginCheck {
	const record = requireRecord(input, label);
	return {
		title: requireString(record.title, `${label}.title`),
		command: requireString(record.command, `${label}.command`),
		args: requireStringArray(record.args, `${label}.args`),
	};
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}
	return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
	return value;
}

function requireString(value: unknown, label: string): string {
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`${label} must be a non-empty string`);
	}
	return value;
}

function optionalString(value: unknown, label: string): string | undefined {
	if (value === undefined || value === "") return undefined;
	return requireString(value, label);
}

function requireStringArray(value: unknown, label: string): string[] {
	return requireArray(value, label).map((item, index) =>
		requireString(item, `${label}[${index}]`),
	);
}

function parseOptionalStringRecord(
	value: unknown,
	label: string,
): Record<string, string> | undefined {
	if (value === undefined) return undefined;
	const record = requireRecord(value, label);
	return Object.fromEntries(
		Object.entries(record).map(([key, entry]) => [
			key,
			requireString(entry, `${label}.${key}`),
		]),
	);
}

function requireBoolean(value: unknown, label: string): boolean {
	if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
	return value;
}

function requireOne(value: unknown, label: string): 1 {
	if (value !== 1) throw new Error(`${label} must be 1`);
	return 1;
}

function requireId(value: unknown, label: string): string {
	const id = requireString(value, label);
	if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
		throw new Error(`${label} must be kebab-case`);
	}
	return id;
}

function requireEnvKey(value: unknown, label: string): string {
	const key = requireString(value, label);
	if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
		throw new Error(`${label} must be SCREAMING_SNAKE_CASE`);
	}
	return key;
}

function requireRelativePath(value: unknown, label: string): string {
	const valuePath = requireString(value, label);
	if (path.isAbsolute(valuePath) || valuePath.includes("..")) {
		throw new Error(`${label} must be a relative path inside the plugin`);
	}
	return valuePath;
}

function requireSemver(value: unknown, label: string): string {
	const version = requireString(value, label);
	if (!/^\d+\.\d+\.\d+$/.test(version)) {
		throw new Error(`${label} must be strict semver`);
	}
	return version;
}
