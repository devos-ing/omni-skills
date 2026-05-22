export const DEFAULT_SERVER_PORT = "3001";
export const DEFAULT_WEB_PORT = "3000";

export function resolveDaemonPorts(env: NodeJS.ProcessEnv): {
	serverPort: string;
	webPort: string;
} {
	const serverPort = parseDaemonPort(
		env.PIV_SERVER_PORT ?? DEFAULT_SERVER_PORT,
		"PIV_SERVER_PORT",
	);
	const webPort = parseDaemonPort(env.PORT ?? DEFAULT_WEB_PORT, "PORT");

	assertDistinctPorts([
		["server", "PIV_SERVER_PORT", serverPort],
		["web", "PORT", webPort],
	]);

	return {
		serverPort: String(serverPort),
		webPort: String(webPort),
	};
}

function parseDaemonPort(rawPort: string, envName: string): number {
	const port = Number(rawPort);
	if (!Number.isInteger(port) || port <= 0 || port > 65535) {
		throw new Error(`${envName} must be a valid TCP port`);
	}
	return port;
}

function assertDistinctPorts(
	assignments: Array<[service: string, envName: string, port: number]>,
): void {
	for (let index = 0; index < assignments.length; index += 1) {
		for (
			let nextIndex = index + 1;
			nextIndex < assignments.length;
			nextIndex += 1
		) {
			const current = assignments[index];
			const next = assignments[nextIndex];
			if (current?.[2] === next?.[2]) {
				throw new Error(
					`Daemon port conflict: ${current[0]} (${current[1]}) and ${next[0]} (${next[1]}) both use port ${current[2]}`,
				);
			}
		}
	}
}
