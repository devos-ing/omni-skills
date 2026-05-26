import type { TraceEvent, TraceRecorder } from "./types/runtime.types";

export class MemoryTraceRecorder implements TraceRecorder {
	readonly events: TraceEvent[] = [];

	record(event: TraceEvent): void {
		this.events.push(event);
	}
}
