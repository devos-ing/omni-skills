import { findClaudeBinary } from "../../utils/claude-path";
import type { LoadedConfig } from "../config";
import type { SetupCheck, SetupCheckDeps } from "../setup.types";
import {
	commandFailureMessage,
	formatMissingRtkMessage,
	safeRun,
} from "./checks-helpers";

export async function addBinaryChecks(
	checks: SetupCheck[],
	config: LoadedConfig,
	commandRunner: NonNullable<SetupCheckDeps["runCommand"]>,
	cwd: string,
): Promise<void> {
	const commandCwd = config.projects[0]?.executionPath ?? cwd;
	const gh = await safeRun(commandRunner, "gh", ["auth", "status"], commandCwd);
	checks.push(
		gh.code === 0
			? { name: "GitHub auth", status: "pass", message: "gh is authenticated" }
			: {
					name: "GitHub auth",
					status: "fail",
					message: commandFailureMessage(gh),
				},
	);
	const rtk = await safeRun(commandRunner, "rtk", ["--version"], commandCwd);
	checks.push(
		rtk.code === 0
			? { name: "RTK binary", status: "pass", message: "rtk is available" }
			: {
					name: "RTK binary",
					status: "fail",
					message: formatMissingRtkMessage(),
				},
	);

	const codexBackends = config.projects.filter(
		(project) => !project.agent?.backend || project.agent.backend === "codex",
	);
	if (codexBackends.length > 0) {
		const codexBinary = config.projects[0]?.codex.binary ?? "codex";
		const codex = await safeRun(
			commandRunner,
			codexBinary,
			["--version"],
			commandCwd,
		);
		checks.push(
			codex.code === 0
				? {
						name: "Codex binary",
						status: "pass",
						message: `${codexBinary} is available`,
					}
				: {
						name: "Codex binary",
						status: "fail",
						message: commandFailureMessage(codex),
					},
		);
	}

	const claudeCodeBackends = config.projects.filter(
		(project) => project.agent?.backend === "claude-code",
	);
	if (claudeCodeBackends.length > 0) {
		const claudePath = findClaudeBinary();
		if (claudePath) {
			const claude = await safeRun(
				commandRunner,
				claudePath,
				["--version"],
				commandCwd,
			);
			checks.push(
				claude.code === 0
					? {
							name: "Claude Code binary",
							status: "pass",
							message: `${claudePath} is available`,
						}
					: {
							name: "Claude Code binary",
							status: "fail",
							message: commandFailureMessage(claude),
						},
			);
		} else {
			checks.push({
				name: "Claude Code binary",
				status: "fail",
				message:
					"claude binary not found. Install with: npm install -g @anthropic-ai/claude-code",
			});
		}
	}
}
