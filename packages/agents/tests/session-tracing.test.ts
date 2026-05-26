import { describe, expect, it } from "bun:test";
import { MemorySessionStore, MemoryTraceRecorder } from "../src";

describe("Sessions and tracing", () => {
	it("stores session entries independently per agent", async () => {
		const store = new MemorySessionStore();
		const entry = {
			agent: "Planner",
			input: "plan",
			output: "done",
			sessionId: "session-1",
			recordedAt: "2026-05-27T00:00:00.000Z",
		};

		await store.append("Planner", entry);

		expect(await store.load("Planner")).toEqual([entry]);
		expect(await store.load("Reviewer")).toEqual([]);
	});

	it("returns copied session arrays so callers cannot mutate store state", async () => {
		const store = new MemorySessionStore();
		await store.append("Planner", {
			agent: "Planner",
			input: "a",
			output: "b",
			recordedAt: "2026-05-27T00:00:00.000Z",
		});

		const loaded = await store.load("Planner");
		loaded.length = 0;

		expect(await store.load("Planner")).toHaveLength(1);
	});

	it("records trace events in order", () => {
		const tracing = new MemoryTraceRecorder();
		const first = {
			type: "agent",
			name: "Planner",
			status: "started" as const,
			recordedAt: "2026-05-27T00:00:00.000Z",
		};
		const second = {
			type: "agent",
			name: "Planner",
			status: "succeeded" as const,
			metadata: { phase: "Plan" },
			recordedAt: "2026-05-27T00:00:01.000Z",
		};

		tracing.record(first);
		tracing.record(second);

		expect(tracing.events).toEqual([first, second]);
	});
});
