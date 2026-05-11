import type { ResolvedProjectConfig } from "./types";
import type { IssueProjectRoutingResult } from "./workflow.types";

export function routeProjectsForIssueProjectId(
	projects: ResolvedProjectConfig[],
	issueProjectId: string | undefined,
): IssueProjectRoutingResult {
	const scopedProjects = projects.filter((project) => project.linear.projectId);
	const unscopedProjects = projects.filter(
		(project) => !project.linear.projectId,
	);

	if (!issueProjectId) {
		if (unscopedProjects.length > 1) {
			return {
				error:
					"Target issue has no Linear project id and multiple unscoped projects are configured. Re-run with --project <PROJECT_ID>.",
			};
		}
		return {
			skipReason:
				"Target issue has no Linear project id and cannot be safely routed in --all-projects mode.",
		};
	}

	const explicitMatches = scopedProjects.filter(
		(project) => project.linear.projectId === issueProjectId,
	);
	if (explicitMatches.length > 1) {
		return {
			error: `Multiple projects are configured with linear.projectId='${issueProjectId}'. Re-run with --project <PROJECT_ID>.`,
		};
	}
	if (explicitMatches.length === 1) {
		return {
			selectedProjectId: explicitMatches[0]?.id,
		};
	}
	if (unscopedProjects.length > 1) {
		return {
			error:
				"No explicit linear.projectId match was found and multiple unscoped projects are configured. Re-run with --project <PROJECT_ID>.",
		};
	}
	return {
		skipReason: `No project configured for linear.projectId='${issueProjectId}'.`,
	};
}
