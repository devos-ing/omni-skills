#!/usr/bin/env bun
import { parseArgs } from "./args";
import { getProjectById, loadConfig } from "./config";
import { logger, normalizeError, setupProcessErrorHandlers } from "./logger";
import { loadRunState, normalizeIssueKey } from "./state";
import { runWorkflow } from "./workflow";

async function main(): Promise<void> {
	setupProcessErrorHandlers();
	const command = parseArgs(process.argv);
	if (command.kind === "help") {
		printHelp();
		return;
	}

	const cwd = process.cwd();
	const config = await loadConfig(cwd);

	if (command.kind === "run") {
		await runWorkflow(config, command.options);
		return;
	}

	if (command.kind === "projects") {
		for (const project of config.projects) {
			process.stdout.write(
				`${[
					project.id,
					project.name,
					`exec=${project.executionPath}`,
					`state=${project.workspacePath}`,
				].join("\t")}\n`,
			);
		}
		return;
	}

	if (command.kind === "status") {
		const project = getProjectById(config, command.projectId);
		if (!project) {
			throw new Error(`Project '${command.projectId}' not found`);
		}
		const key = normalizeIssueKey(command.issueKey);
		const state = await loadRunState(project.workspacePath, project.id, key);
		if (!state) {
			process.stdout.write(
				`No run state found for ${key} in project ${project.id}\n`,
			);
			return;
		}
		process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
		return;
	}
}

function printHelp(): void {
	process.stdout.write(
		`${[
			"piv-loop - Codex CLI orchestration workflow",
			"",
			"Commands:",
			"  piv-loop run [--project <PROJECT_ID>] [--issue <LINEAR_KEY_OR_URL>]",
			"  piv-loop run --all-projects [--issue <LINEAR_KEY_OR_URL>]",
			"  piv-loop status --project <PROJECT_ID> --issue <LINEAR_KEY>",
			"  piv-loop projects",
			"  piv-loop help",
			"",
			"Environment:",
			"  LINEAR_API_KEY, LINEAR_STATUS_* state IDs, GITHUB_* repo settings",
		].join("\n")}\n`,
	);
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	logger.error({ err: normalizeError(error) }, message);
	process.exitCode = 1;
});
