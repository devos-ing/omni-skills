import type { RunState } from "../../features/types";
import {
	applyRunLease,
	clearRunLease,
	hasRunLeaseConflict,
	saveRunState,
} from "./state";

export function buildRunLeaseOwnerId(nowMs = Date.now()): string {
	return `${process.pid}-${nowMs}-${Math.floor(Math.random() * 100000)}`;
}

export async function tryAcquireRunLease(
	cwd: string,
	state: RunState,
	leaseOwnerId: string,
	leaseTimeoutMs: number,
): Promise<boolean> {
	const nowMs = Date.now();
	if (hasRunLeaseConflict(state, leaseOwnerId, nowMs)) {
		return false;
	}
	Object.assign(
		state,
		applyRunLease(state, leaseOwnerId, leaseTimeoutMs, nowMs),
	);
	await saveRunState(cwd, state);
	return true;
}

export async function heartbeatRunLease(
	cwd: string,
	state: RunState,
	leaseOwnerId: string,
	leaseTimeoutMs: number,
): Promise<void> {
	const nowMs = Date.now();
	if (hasRunLeaseConflict(state, leaseOwnerId, nowMs)) {
		throw new Error(
			"Run lease is no longer owned by the active worker; stopping issue execution.",
		);
	}
	Object.assign(
		state,
		applyRunLease(state, leaseOwnerId, leaseTimeoutMs, nowMs),
	);
	await saveRunState(cwd, state);
}

export async function releaseRunLease(
	cwd: string,
	state: RunState,
	leaseOwnerId: string,
): Promise<void> {
	if (!state.lease?.ownerId || state.lease.ownerId !== leaseOwnerId) {
		return;
	}
	Object.assign(state, clearRunLease(state));
	await saveRunState(cwd, state);
}
