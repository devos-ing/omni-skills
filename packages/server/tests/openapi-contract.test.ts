import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { READ_ONLY_SERVER_PATHS } from "../src/routes";

const IMPLEMENTED_ROUTES = [
	["GET", "/health"],
	["GET", "/api/cli/history"],
	["POST", "/api/cli/dispatch"],
	["GET", "/api/projects"],
	["POST", "/api/projects"],
	["GET", "/api/projects/{id}"],
	["PATCH", "/api/projects/{id}"],
	["DELETE", "/api/projects/{id}"],
	["GET", "/api/tasks"],
	["POST", "/api/tasks"],
	["GET", "/api/tasks/{id}"],
	["PATCH", "/api/tasks/{id}"],
	["DELETE", "/api/tasks/{id}"],
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

describe("openapi contract", () => {
	it("includes all implemented Express routes", () => {
		const root = path.resolve(__dirname, "../..", "..");
		const openApiPath = path.join(root, "openapi.yaml");
		const openApiText = readFileSync(openApiPath, "utf-8");
		const documentedRoutes = extractOpenApiRoutes(openApiText);

		expect(documentedRoutes.size).toBeGreaterThan(0);
		for (const [method, routePath] of IMPLEMENTED_ROUTES) {
			expect(documentedRoutes.has(`${method} ${routePath}`)).toBeTrue();
		}
		for (const implementedPath of READ_ONLY_SERVER_PATHS) {
			expect(documentedRoutes.has(`GET ${implementedPath}`)).toBeTrue();
		}
	});
});
