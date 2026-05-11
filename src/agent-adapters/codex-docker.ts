import path from "node:path";
import type { ResolvedProjectConfig } from "../core/types";

export interface CodexRuntimeInvocation {
	command: string;
	args: string[];
	cwd: string;
	env?: Record<string, string | undefined>;
	hostOutputFile: string;
}

export function buildCodexRuntimeInvocation(
	config: ResolvedProjectConfig,
	codexArgs: string[],
): CodexRuntimeInvocation {
	const hostOutputFile =
		codexArgs[codexArgs.indexOf("--output-last-message") + 1] ?? "";
	const codexHome = config.codex.codexHome;
	const env = codexHome ? { CODEX_HOME: codexHome } : undefined;
	const dockerConfig = config.codex.docker;
	if (!dockerConfig?.enabled || !dockerConfig.image) {
		return {
			command: config.codex.binary,
			args: codexArgs,
			cwd: config.executionPath,
			env,
			hostOutputFile,
		};
	}

	const dockerBinary = dockerConfig.binary ?? "docker";
	const containerWorkspace = normalizeContainerPath(
		dockerConfig.workspacePath,
		"/workspace",
	);
	const containerExecution = normalizeContainerPath(
		dockerConfig.executionPath,
		path.posix.join(containerWorkspace, "repo"),
	);
	const containerCodexHome = normalizeContainerPath(
		dockerConfig.codexHomePath,
		"/codex-home",
	);

	const mappedCodexArgs = mapCodexPaths(
		codexArgs,
		config.executionPath,
		config.workspacePath,
		containerExecution,
		containerWorkspace,
		hostOutputFile,
	);
	const dockerArgs = [
		"run",
		"--rm",
		"-v",
		`${config.workspacePath}:${containerWorkspace}`,
	];
	if (!isDescendantPath(config.executionPath, config.workspacePath)) {
		dockerArgs.push("-v", `${config.executionPath}:${containerExecution}`);
	}
	if (codexHome) {
		dockerArgs.push("-v", `${codexHome}:${containerCodexHome}`);
		dockerArgs.push("-e", `CODEX_HOME=${containerCodexHome}`);
	}
	dockerArgs.push("-w", containerExecution);
	dockerArgs.push(dockerConfig.image);
	dockerArgs.push(config.codex.binary, ...mappedCodexArgs);

	return {
		command: dockerBinary,
		args: dockerArgs,
		cwd: config.executionPath,
		hostOutputFile,
	};
}

function mapCodexPaths(
	args: string[],
	hostExecutionPath: string,
	hostWorkspacePath: string,
	containerExecutionPath: string,
	containerWorkspacePath: string,
	hostOutputFile: string,
): string[] {
	const mapped = [...args];
	const cdIndex = mapped.indexOf("--cd");
	if (cdIndex >= 0 && cdIndex + 1 < mapped.length) {
		mapped[cdIndex + 1] = mapHostPathToContainer(
			mapped[cdIndex + 1],
			hostExecutionPath,
			hostWorkspacePath,
			containerExecutionPath,
			containerWorkspacePath,
		);
	}
	const outputIndex = mapped.indexOf("--output-last-message");
	if (outputIndex >= 0 && outputIndex + 1 < mapped.length) {
		mapped[outputIndex + 1] = mapHostPathToContainer(
			hostOutputFile,
			hostExecutionPath,
			hostWorkspacePath,
			containerExecutionPath,
			containerWorkspacePath,
		);
	}
	return mapped;
}

function mapHostPathToContainer(
	hostPath: string,
	hostExecutionPath: string,
	hostWorkspacePath: string,
	containerExecutionPath: string,
	containerWorkspacePath: string,
): string {
	if (isDescendantPath(hostPath, hostExecutionPath)) {
		const rel = path.relative(hostExecutionPath, hostPath);
		return rel
			? path.posix.join(containerExecutionPath, toPosix(rel))
			: containerExecutionPath;
	}
	if (isDescendantPath(hostPath, hostWorkspacePath)) {
		const rel = path.relative(hostWorkspacePath, hostPath);
		return rel
			? path.posix.join(containerWorkspacePath, toPosix(rel))
			: containerWorkspacePath;
	}
	return hostPath;
}

function normalizeContainerPath(
	input: string | undefined,
	fallback: string,
): string {
	const raw = (input ?? fallback).trim();
	const normalized = raw.replace(/\\/g, "/");
	return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function isDescendantPath(target: string, parent: string): boolean {
	const relative = path.relative(parent, target);
	return (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	);
}

function toPosix(value: string): string {
	return value.split(path.sep).join(path.posix.sep);
}
