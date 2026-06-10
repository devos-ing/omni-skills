import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { READ_ONLY_SERVER_PATHS } from "../src/routes";

const IMPLEMENTED_ROUTES = [
	["GET", "/health"],
	["GET", "/api/cli/history"],
	["GET", "/api/github/repositories/search"],
	["GET", "/api/projects"],
	["POST", "/api/projects"],
	["GET", "/api/projects/{id}"],
	["PATCH", "/api/projects/{id}"],
	["DELETE", "/api/projects/{id}"],
	["GET", "/api/github/connection"],
	["DELETE", "/api/github/connection"],
	["GET", "/api/github/oauth/start"],
	["GET", "/api/github/oauth/callback"],
	["POST", "/api/github/device/start"],
	["POST", "/api/github/device/poll"],
	["GET", "/api/github/repositories"],
	["GET", "/api/tasks"],
	["POST", "/api/tasks"],
	["POST", "/api/tasks/chat-create"],
	["GET", "/api/tasks/{id}"],
	["PATCH", "/api/tasks/{id}"],
	["DELETE", "/api/tasks/{id}"],
	["GET", "/api/tasks/{id}/activity"],
	["GET", "/api/chat/sessions"],
	["POST", "/api/chat/sessions"],
	["PATCH", "/api/chat/sessions/{id}"],
	["DELETE", "/api/chat/sessions/{id}"],
	["GET", "/api/chat/sessions/{id}/status"],
	["GET", "/api/chat/sessions/{id}/messages"],
	["POST", "/api/chat/sessions/{id}/messages"],
	["POST", "/api/chat/sessions/{id}/send"],
	["GET", "/api/inbox/messages"],
	["POST", "/api/inbox/messages"],
	["GET", "/api/agents"],
	["POST", "/api/agents"],
	["GET", "/api/agents/{id}"],
	["PATCH", "/api/agents/{id}"],
	["DELETE", "/api/agents/{id}"],
	["GET", "/api/skills"],
	["POST", "/api/skills"],
	["GET", "/api/skills/{id}"],
	["PATCH", "/api/skills/{id}"],
	["DELETE", "/api/skills/{id}"],
	["GET", "/api/workspaces/{workspaceId}/projects"],
	["GET", "/api/workspaces/{workspaceId}/projects/{projectId}/board"],
	["POST", "/api/notifications"],
	["POST", "/api/notifications/email"],
	["GET", "/api/polling/status"],
	["GET", "/api/settings/github"],
	["PATCH", "/api/settings/github"],
	["GET", "/api/settings/models"],
	["PATCH", "/api/settings/models"],
] as const;

const PROJECT_MUTATION_FIELDS = [
	"boardId",
	"name",
	"ownerId",
	"emoji",
	"externalProjectId",
	"description",
	"repoOwner",
	"repoName",
	"baseBranch",
	"localFolder",
	"lead",
	"category",
	"priority",
] as const;

const AGENT_UPDATE_FIELDS = [
	"name",
	"description",
	"logo",
	"runtime",
	"backend",
	"model",
	"reasoningEffort",
	"status",
	"concurrency",
	"owner",
	"createdAt",
	"updatedAt",
	"skills",
	"recentWork",
	"activity",
	"instructions",
] as const;

const CHAT_SESSION_UPDATE_FIELDS = [
	"archived",
	"lastSeenAt",
	"projectId",
	"title",
	"pendingRequest",
	"pendingQuestions",
] as const;

function extractOpenApiRoutes(openApiDocument: string): Set<string> {
	const pathsSection = openApiDocument.match(
		/(^|\n)paths:\n([\s\S]*?)(\n[a-zA-Z0-9_-]+:|\n?$)/,
	);
	if (!pathsSection?.[2]) {
		return new Set();
	}

	const routes = new Set<string>();
	let currentPath: string | null = null;
	for (const line of pathsSection[2].split("\n")) {
		const pathMatch = line.match(/^ {2}(\/[^:]+):\s*$/);
		if (pathMatch?.[1]) {
			currentPath = pathMatch[1];
			continue;
		}
		const methodMatch = line.match(/^ {4}(get|post|patch|delete):\s*$/);
		if (currentPath && methodMatch?.[1]) {
			routes.add(`${methodMatch[1].toUpperCase()} ${currentPath}`);
		}
	}
	return routes;
}

function extractTopLevelTagNames(openApiDocument: string): string[] {
	const tagsSection = openApiDocument.match(
		/(^|\n)tags:\n([\s\S]*?)(\npaths:)/,
	);
	if (!tagsSection?.[2]) {
		return [];
	}
	return tagsSection[2].split("\n").flatMap((line) => {
		const tagMatch = line.match(/^ {2}- name: (.+)\s*$/);
		return tagMatch?.[1] ? [tagMatch[1]] : [];
	});
}

function findUntypedNullableSchemaLines(openApiDocument: string): number[] {
	const lines = openApiDocument.split("\n");
	const untypedLines: number[] = [];
	for (const [index, line] of lines.entries()) {
		const nullableMatch = line.match(/^(\s*)nullable:\s*true\s*$/);
		if (!nullableMatch?.[1]) {
			continue;
		}
		const indent = nullableMatch[1].length;
		if (!schemaBlockHasSiblingType(lines, index, indent)) {
			untypedLines.push(index + 1);
		}
	}
	return untypedLines;
}

function schemaBlockHasSiblingType(
	lines: string[],
	nullableIndex: number,
	indent: number,
): boolean {
	for (let index = nullableIndex - 1; index >= 0; index -= 1) {
		const line = lines[index] ?? "";
		const lineIndent = leadingSpaceCount(line);
		if (line.trim() && lineIndent < indent) {
			break;
		}
		if (lineIndent === indent && line.trim().startsWith("type:")) {
			return true;
		}
	}
	for (let index = nullableIndex + 1; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const lineIndent = leadingSpaceCount(line);
		if (line.trim() && lineIndent < indent) {
			break;
		}
		if (lineIndent === indent && line.trim().startsWith("type:")) {
			return true;
		}
	}
	return false;
}

function extractSchemaBlock(
	openApiDocument: string,
	schemaName: string,
): string {
	const schemaMatch = openApiDocument.match(
		new RegExp(`\\n    ${schemaName}:\\n([\\s\\S]*?)(\\n    [A-Za-z0-9]+:|$)`),
	);
	return schemaMatch?.[1] ?? "";
}

function leadingSpaceCount(line: string): number {
	return line.match(/^ */)?.[0].length ?? 0;
}

function readOpenApiText(): string {
	const root = path.resolve(__dirname, "../..", "..");
	return readFileSync(path.join(root, "openapi.yaml"), "utf-8");
}

describe("openapi contract", () => {
	it("includes all implemented Express routes", () => {
		const openApiText = readOpenApiText();
		const documentedRoutes = extractOpenApiRoutes(openApiText);

		expect(documentedRoutes.size).toBeGreaterThan(0);
		for (const [method, routePath] of IMPLEMENTED_ROUTES) {
			expect(documentedRoutes.has(`${method} ${routePath}`)).toBeTrue();
		}
		for (const implementedPath of READ_ONLY_SERVER_PATHS) {
			expect(documentedRoutes.has(`GET ${implementedPath}`)).toBeTrue();
		}
	});

	it("keeps top-level tags unique", () => {
		const tags = extractTopLevelTagNames(readOpenApiText());

		expect(new Set(tags).size).toBe(tags.length);
	});

	it("keeps nullable schemas compatible with the OpenAPI validator", () => {
		const openApiText = readOpenApiText();

		expect(findUntypedNullableSchemaLines(openApiText)).toEqual([]);
	});

	it("documents all implemented agent update fields", () => {
		const openApiText = readOpenApiText();
		const agentPatchFields = extractSchemaBlock(
			openApiText,
			"AgentPatchFields",
		);

		for (const field of AGENT_UPDATE_FIELDS) {
			expect(agentPatchFields).toContain(`${field}:`);
		}
	});

	it("documents all project mutation fields", () => {
		const openApiText = readOpenApiText();
		const projectCreateFields = extractSchemaBlock(
			openApiText,
			"ProjectCreateRequest",
		);
		const projectPatchFields = extractSchemaBlock(
			openApiText,
			"ProjectPatchFields",
		);

		for (const field of PROJECT_MUTATION_FIELDS) {
			expect(projectCreateFields).toContain(`${field}:`);
			expect(projectPatchFields).toContain(`${field}:`);
		}
	});

	it("documents all chat session update fields", () => {
		const chatSessionUpdateFields = extractSchemaBlock(
			readOpenApiText(),
			"ChatSessionUpdateRequest",
		);

		for (const field of CHAT_SESSION_UPDATE_FIELDS) {
			expect(chatSessionUpdateFields).toContain(`${field}:`);
		}
	});
});
