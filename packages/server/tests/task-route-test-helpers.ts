import type { ServerDatabase } from "devos-db";
import type { RealtimeEventPublisher } from "../src/realtime";
import { createServerTestApp, seedServerTestProject } from "./app-test-helpers";

export function createTaskRouteTestApp(
	db: ServerDatabase["db"],
	realtimeEvents?: RealtimeEventPublisher,
) {
	return createServerTestApp(db, {
		realtimeEvents,
	});
}

export async function seedTaskRouteProject(
	db: ServerDatabase["db"],
	projectId = "project-1",
): Promise<void> {
	await seedServerTestProject(db, projectId);
}
