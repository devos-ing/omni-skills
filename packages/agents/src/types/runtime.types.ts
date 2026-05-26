export interface SessionEntry {
	agent: string;
	input: unknown;
	output: unknown;
	sessionId?: string;
	recordedAt: string;
}

export interface SessionStore {
	load(agentName: string): Promise<SessionEntry[]>;
	append(agentName: string, entry: SessionEntry): Promise<void>;
}

export interface TraceEvent {
	type: string;
	name: string;
	status: "started" | "succeeded" | "failed";
	metadata?: Record<string, unknown>;
	recordedAt: string;
}

export interface TraceRecorder {
	record(event: TraceEvent): Promise<void> | void;
}

export interface HumanInterruption {
	reason: string;
	questions?: string[];
	metadata?: Record<string, unknown>;
}
