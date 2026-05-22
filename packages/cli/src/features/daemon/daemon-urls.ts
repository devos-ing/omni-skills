import { resolveDaemonPorts } from "./daemon-ports";

export function resolveServerBaseUrl(env: NodeJS.ProcessEnv): string {
	const { serverPort } = resolveDaemonPorts(env);
	return env.DEVOS_SERVER_BASE_URL ?? `http://127.0.0.1:${serverPort}`;
}

export function resolveWebUrl(env: NodeJS.ProcessEnv): string {
	const { webPort } = resolveDaemonPorts(env);
	return `http://127.0.0.1:${webPort}`;
}

export function resolveServerEventsWsUrl(serverBaseUrl: string): string {
	return resolveWsUrl(serverBaseUrl, "/daemon/events");
}

export function resolveWorkflowWsUrl(serverBaseUrl: string): string {
	return resolveWsUrl(serverBaseUrl, "/api/workflow");
}

function resolveWsUrl(baseUrl: string, pathname: string): string {
	const url = new URL(pathname, baseUrl);
	if (url.protocol === "http:") {
		url.protocol = "ws:";
	}
	if (url.protocol === "https:") {
		url.protocol = "wss:";
	}
	return url.toString();
}

export function resolveWorkflowWorkerUrl(env: NodeJS.ProcessEnv): string {
	return (
		env.DEVOS_WORKFLOW_WS_URL ?? resolveWorkflowWsUrl(resolveServerBaseUrl(env))
	);
}
