import { afterEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import {
	type NewAgentRow,
	type NewCommandHistoryRow,
	type NewJobRow,
	type NewSkillRow,
	type NewTokenUsageRow,
	agentsTable,
	commandHistoryTable,
	initializeServerDatabase,
	jobsTable,
	skillsTable,
	tokenUsageTable,
} from "../src/db";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "./server-db-test-helpers";

let testDatabase: DrizzleServerTestDatabase | undefined;

afterEach(async () => {
	if (testDatabase) {
		await testDatabase.cleanup();
		testDatabase = undefined;
	}
});

describe("server drizzle schema", () => {
	it("inserts and reads representative records for all tables", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const { db } = testDatabase;

		const tokenUsage: NewTokenUsageRow = {
			id: "tu-1",
			runId: "run-1",
			stage: "planning",
			inputTokens: 10,
			outputTokens: 5,
			totalTokens: 15,
			recordedAt: "2026-05-12 00:00:00",
		};
		const job: NewJobRow = {
			id: "job-1",
			projectId: "default",
			issueKey: "ROY-131",
			stage: "implementing",
			status: "in_progress",
			createdAt: "2026-05-12 00:01:00",
		};
		const agent: NewAgentRow = {
			id: "agent-1",
			name: "codex-main",
			backend: "codex",
			model: "gpt-5",
			createdAt: "2026-05-12 00:02:00",
		};
		const skill: NewSkillRow = {
			id: "skill-1",
			name: "backend-standard",
			description: "Backend implementation guidance",
			source: "folder",
			updatedAt: "2026-05-12 00:03:00",
		};
		const commandHistory: NewCommandHistoryRow = {
			id: "cmd-1",
			command: "bun test",
			exitCode: 0,
			executedAt: "2026-05-12 00:04:00",
		};

		await db.insert(tokenUsageTable).values(tokenUsage);
		await db.insert(jobsTable).values(job);
		await db.insert(agentsTable).values(agent);
		await db.insert(skillsTable).values(skill);
		await db.insert(commandHistoryTable).values(commandHistory);

		const [tokenUsageRow] = await db
			.select()
			.from(tokenUsageTable)
			.where(eq(tokenUsageTable.id, tokenUsage.id));
		const [jobRow] = await db
			.select()
			.from(jobsTable)
			.where(eq(jobsTable.id, job.id));
		const [agentRow] = await db
			.select()
			.from(agentsTable)
			.where(eq(agentsTable.id, agent.id));
		const [skillRow] = await db
			.select()
			.from(skillsTable)
			.where(eq(skillsTable.id, skill.id));
		const [commandHistoryRow] = await db
			.select()
			.from(commandHistoryTable)
			.where(eq(commandHistoryTable.id, commandHistory.id));

		expect(tokenUsageRow).toEqual(tokenUsage);
		expect(jobRow).toEqual(job);
		expect(agentRow).toEqual(agent);
		expect(skillRow).toEqual(skill);
		expect(commandHistoryRow).toEqual(commandHistory);
	});

	it("initializes the same database path twice without startup errors", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const reopened = await initializeServerDatabase(testDatabase.path);
		await reopened.close();
	});
});
