import path from "node:path";
import type { AgentAdapterRuntimeConfig } from "../../../types/agent-adapter.types";

export interface CodexRuntimeInvocation {
	command: string;
	args: string[];
	cwd: string;
	env?: Record<string, string | undefined>;
	hostOutputFile: string;
}

export function buildCodexRuntimeInvocation(
	config: AgentAdapterRuntimeConfig,
	codexArgs: string[],
): CodexRuntimeInvocation {
	const hostWorkspacePath = path.resolve(config.workspacePath);
	const hostExecutionPath = path.resolve(config.executionPath);
	const rawOutputFile =
		codexArgs[codexArgs.indexOf("--output-last-message") + 1] ?? "";
	const hostOutputFile = rawOutputFile ? path.resolve(rawOutputFile) : "";
	const hostCodexHome = config.codex.codexHome
		? path.resolve(config.codex.codexHome)
		: undefined;
	const env = hostCodexHome ? { CODEX_HOME: hostCodexHome } : undefined;
	const dockerConfig = config.codex.docker;
	const hostCodexArgs = mapCodexHostPaths(
		codexArgs,
		hostExecutionPath,
		hostOutputFile,
	);
	if (!dockerConfig?.enabled || !dockerConfig.image) {
		return {
			command: config.codex.binary,
			args: hostCodexArgs,
			cwd: hostExecutionPath,
			env,
			hostOutputFile,
		};
	}

	const dockerBinary = dockerConfig.binary ?? "docker";
	const containerWorkspace = normalizeContainerPath(
		dockerConfig.workspacePath,
		"/workspace",
	);
	const defaultContainerExecution = isDescendantPath(
		hostExecutionPath,
		hostWorkspacePath,
	)
		? joinContainerPath(
				containerWorkspace,
				path.relative(hostWorkspacePath, hostExecutionPath),
			)
		: path.posix.join(containerWorkspace, "repo");
	const containerExecution = normalizeContainerPath(
		dockerConfig.executionPath,
		defaultContainerExecution,
	);
	const containerCodexHome = normalizeContainerPath(
		dockerConfig.codexHomePath,
		"/codex-home",
	);

	const mappedCodexArgs = mapCodexPaths(
		hostCodexArgs,
		hostExecutionPath,
		hostWorkspacePath,
		containerExecution,
		containerWorkspace,
		hostOutputFile,
	);
	const dockerArgs = [
		"run",
		"--rm",
		"-v",
		`${hostWorkspacePath}:${containerWorkspace}`,
	];
	if (!isDescendantPath(hostExecutionPath, hostWorkspacePath)) {
		dockerArgs.push("-v", `${hostExecutionPath}:${containerExecution}`);
	}
	if (hostCodexHome) {
		dockerArgs.push("-v", `${hostCodexHome}:${containerCodexHome}`);
		dockerArgs.push("-e", `CODEX_HOME=${containerCodexHome}`);
	}
	dockerArgs.push("-w", containerExecution);
	dockerArgs.push(dockerConfig.image);
	dockerArgs.push(config.codex.binary, ...mappedCodexArgs);

	return {
		command: dockerBinary,
		args: dockerArgs,
		cwd: hostExecutionPath,
		hostOutputFile,
	};
}

function mapCodexHostPaths(
	args: string[],
	hostExecutionPath: string,
	hostOutputFile: string,
): string[] {
	const mapped = [...args];
	mapRepeatedOptionValues(mapped, "--add-dir", (value) => path.resolve(value));
	const cdIndex = mapped.indexOf("--cd");
	if (cdIndex >= 0 && cdIndex + 1 < mapped.length) {
		mapped[cdIndex + 1] = path.resolve(mapped[cdIndex + 1]);
	}
	const outputIndex = mapped.indexOf("--output-last-message");
	if (outputIndex >= 0 && outputIndex + 1 < mapped.length) {
		mapped[outputIndex + 1] = hostOutputFile;
	}
	if (cdIndex < 0 && mapped[0] === "exec" && mapped[1] !== "resume") {
		mapped.splice(1, 0, "--cd", hostExecutionPath);
	}
	return mapped;
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
	mapRepeatedOptionValues(mapped, "--add-dir", (value) =>
		mapHostPathToContainer(
			value,
			hostExecutionPath,
			hostWorkspacePath,
			containerExecutionPath,
			containerWorkspacePath,
		),
	);
	return mapped;
}

function mapRepeatedOptionValues(
	args: string[],
	option: string,
	mapper: (value: string) => string,
): void {
	for (let index = 0; index < args.length - 1; index += 1) {
		if (args[index] !== option) {
			continue;
		}
		args[index + 1] = mapper(args[index + 1] ?? "");
		index += 1;
	}
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

function joinContainerPath(basePath: string, relativePath: string): string {
	const normalizedRel = toPosix(relativePath);
	return normalizedRel ? path.posix.join(basePath, normalizedRel) : basePath;
}
