import type {
	DaemonHttpReadinessOptions,
	DaemonReadinessShouldStop,
} from "./daemon.types";

export const DAEMON_SERVICE_READY_INTERVAL_MS = 500;
export const DAEMON_SERVICE_READY_TIMEOUT_MS = 30_000;

export function waitForDaemonHttpReady(
	url: string,
	shouldStop?: DaemonReadinessShouldStop,
): Promise<void>;
export function waitForDaemonHttpReady(
	url: string,
	options?: DaemonHttpReadinessOptions,
): Promise<void>;
export async function waitForDaemonHttpReady(
	url: string,
	input: DaemonHttpReadinessOptions | DaemonReadinessShouldStop = {},
): Promise<void> {
	const options = typeof input === "function" ? { shouldStop: input } : input;
	const fetchReady = options.fetch ?? fetchDaemonService;
	const intervalMs = options.intervalMs ?? DAEMON_SERVICE_READY_INTERVAL_MS;
	const shouldStop = options.shouldStop ?? (() => false);
	const sleep = options.sleep ?? sleepFor;
	const timeoutMs = options.timeoutMs ?? DAEMON_SERVICE_READY_TIMEOUT_MS;
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;

	while (!shouldStop() && Date.now() <= deadline) {
		try {
			const response = await fetchReady(url);
			if (response.ok) {
				return;
			}
		} catch (error) {
			lastError = error;
		}
		await sleep(intervalMs);
	}
	if (shouldStop()) {
		return;
	}

	const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
	throw new Error(`Timed out waiting for daemon service at ${url}${detail}`);
}

async function fetchDaemonService(url: string): Promise<{ ok: boolean }> {
	return fetch(url);
}

function sleepFor(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
