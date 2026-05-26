import type { SessionEntry, SessionStore } from "./types/runtime.types";

export class MemorySessionStore implements SessionStore {
	private readonly entries = new Map<string, SessionEntry[]>();

	async load(agentName: string): Promise<SessionEntry[]> {
		return [...(this.entries.get(agentName) ?? [])];
	}

	async append(agentName: string, entry: SessionEntry): Promise<void> {
		this.entries.set(agentName, [
			...(this.entries.get(agentName) ?? []),
			entry,
		]);
	}
}
