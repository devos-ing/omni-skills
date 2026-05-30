import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "devos-db";
import {
	type NewAgentRow,
	type NewBoardProjectRow,
	type NewBoardTaskRow,
	type NewCommandHistoryRow,
	type NewInboxMessageRow,
	type NewJobRow,
	type NewProjectBoardRow,
	type NewProjectCronJobRow,
	type NewSkillRow,
	type NewTaskAssigneeRow,
	type NewTaskCommentRow,
	type NewTaskExecutionLogRow,
	type NewTaskExecutionStepRow,
	type NewTaskPullRequestRow,
	type NewTaskTagRow,
	type NewTokenUsageRow,
	agentsTable,
	boardProjectsTable,
	boardTasksTable,
	commandHistoryTable,
	inboxMessagesTable,
	initializeServerDatabase,
	jobsTable,
	projectBoardsTable,
	projectCronJobsTable,
	skillsTable,
	taskAssigneesTable,
	taskCommentsTable,
	taskExecutionLogsTable,
	taskExecutionStepsTable,
	taskPullRequestsTable,
	taskTagsTable,
	tokenUsageTable,
} from "devos-db";
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
	it("inserts and reads representative records for operational tables", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const { db } = testDatabase;

		const tokenUsage: NewTokenUsageRow = {
			id: "tu-1",
			runId: "run-1",
			taskId: null,
			taskExecutionLogId: null,
			stage: "planning",
			agentBackend: "codex",
			model: "gpt-5",
			inputTokens: 10,
			outputTokens: 5,
			totalTokens: 15,
			estimatedCostMicrousd: 200,
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
			description: "Primary coding agent",
			logo: "https://example.com/codex.svg",
			runtime: "codex",
			backend: "codex",
			model: "gpt-5",
			reasoningEffort: null,
			status: "online",
			concurrency: 2,
			owner: "owner-1",
			createdAt: "2026-05-12 00:02:00",
			updatedAt: "2026-05-12 00:03:00",
			skills: JSON.stringify(["adhd-plan", "adhd-implement"]),
			recentWork: JSON.stringify(["ROY-228"]),
			activity: JSON.stringify(["planning"]),
			instructions: "Keep responses implementation-focused.",
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
		const inboxMessage: NewInboxMessageRow = {
			id: "msg-1",
			workspaceId: "workspace-1",
			userId: "user-1",
			runId: "run-1",
			source: "agent_workflow_event",
			kind: "task_status_update",
			body: "Task moved to implementing",
			taskId: null,
			agentId: null,
			metadata: '{"stage":"implementing"}',
			createdAt: "2026-05-12 00:05:00",
		};

		await db.insert(tokenUsageTable).values(tokenUsage);
		await db.insert(jobsTable).values(job);
		await db.insert(agentsTable).values(agent);
		await db.insert(skillsTable).values(skill);
		await db.insert(commandHistoryTable).values(commandHistory);
		await db.insert(inboxMessagesTable).values(inboxMessage);

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
		const [inboxMessageRow] = await db
			.select()
			.from(inboxMessagesTable)
			.where(eq(inboxMessagesTable.id, inboxMessage.id));

		expect(tokenUsageRow?.id).toBe(tokenUsage.id);
		expect(tokenUsageRow?.runId).toBe(tokenUsage.runId);
		expect(tokenUsageRow?.taskId).toBeNull();
		expect(tokenUsageRow?.taskExecutionLogId).toBeNull();
		expect(tokenUsageRow?.stage).toBe(tokenUsage.stage);
		expect(tokenUsageRow?.agentBackend).toBe("codex");
		expect(tokenUsageRow?.model).toBe("gpt-5");
		expect(tokenUsageRow?.inputTokens).toBe(tokenUsage.inputTokens);
		expect(tokenUsageRow?.outputTokens).toBe(tokenUsage.outputTokens);
		expect(tokenUsageRow?.totalTokens).toBe(tokenUsage.totalTokens);
		expect(tokenUsageRow?.estimatedCostMicrousd).toBe(200);
		expect(tokenUsageRow?.recordedAt).toBe(tokenUsage.recordedAt);
		expect(jobRow).toEqual(job);
		expect(agentRow).toEqual({
			...agent,
			reasoningEffort: null,
			status: "online",
		});
		expect(skillRow).toEqual(skill);
		expect(commandHistoryRow).toEqual(commandHistory);
		expect(inboxMessageRow).toEqual({
			...inboxMessage,
			taskId: inboxMessage.taskId ?? null,
			agentId: inboxMessage.agentId ?? null,
			metadata: inboxMessage.metadata ?? null,
		});
	});

	it("supports project board workflow relationships", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const { db } = testDatabase;

		const board: NewProjectBoardRow = {
			id: "board-1",
			name: "Core Platform Board",
			description: "Tracks platform workflow execution",
			ownerId: "user-1",
			createdAt: "2026-05-12 01:00:00",
			updatedAt: "2026-05-12 01:00:00",
		};
		const project: NewBoardProjectRow = {
			id: "project-1",
			boardId: board.id,
			externalProjectId: "ROY",
			name: "ADHD Server",
			description: "Server-side workflow work",
			repoOwner: "octo",
			repoName: "repo",
			baseBranch: "main",
			localFolder: "/tmp/repo",
			lead: "Roy",
			category: "platform",
			priority: 1,
			ownerId: "user-1",
			createdAt: "2026-05-12 01:01:00",
			updatedAt: "2026-05-12 01:01:00",
		};
		const task: NewBoardTaskRow = {
			id: "task-1",
			taskKey: "TASK-000001",
			projectId: project.id,
			title: "Design schema",
			content: "Define persistent schema for board workflow",
			priority: 1,
			status: "open",
			dueDate: "2026-05-20 00:00:00",
			creatorId: "user-1",
			linkedPr: "https://github.com/acme/repo/pull/42",
			createdAt: "2026-05-12 01:02:00",
			updatedAt: "2026-05-12 01:02:00",
		};
		const humanAssignee: NewTaskAssigneeRow = {
			id: "assignee-1",
			taskId: task.id,
			assigneeId: "user-2",
			assigneeType: "human",
			createdAt: "2026-05-12 01:03:00",
		};
		const agentAssignee: NewTaskAssigneeRow = {
			id: "assignee-2",
			taskId: task.id,
			assigneeId: "agent-99",
			assigneeType: "agent",
			createdAt: "2026-05-12 01:03:10",
		};
		const taskTag: NewTaskTagRow = {
			id: "tag-1",
			taskId: task.id,
			tag: "backend",
		};
		const taskPr: NewTaskPullRequestRow = {
			id: "pr-1",
			taskId: task.id,
			repository: "acme/repo",
			prNumber: "42",
			prUrl: "https://github.com/acme/repo/pull/42",
			branch: "OWN-1",
			createdAt: "2026-05-12 01:04:00",
		};
		const executionLog: NewTaskExecutionLogRow = {
			id: "exec-1",
			taskId: task.id,
			status: "success",
			startedAt: "2026-05-12 01:05:00",
			finishedAt: "2026-05-12 01:06:00",
			log: "Implemented schema and tests",
		};
		const executionStep: NewTaskExecutionStepRow = {
			id: "step-1",
			executionLogId: executionLog.id,
			stepNumber: 1,
			action: "create_tables",
			status: "success",
			detail: "Created board/task tables",
			recordedAt: "2026-05-12 01:05:30",
		};
		const taskComment: NewTaskCommentRow = {
			id: "comment-1",
			taskId: task.id,
			authorId: "user-2",
			authorType: "human",
			comment: "Schema review complete",
			createdAt: "2026-05-12 01:07:00",
		};
		const taskTokenUsage: NewTokenUsageRow = {
			id: "tu-task-1",
			runId: "run-2",
			taskId: task.id,
			taskExecutionLogId: executionLog.id,
			stage: "implement",
			agentBackend: "codex",
			model: "gpt-5",
			inputTokens: 100,
			outputTokens: 200,
			totalTokens: 300,
			estimatedCostMicrousd: 5000,
			recordedAt: "2026-05-12 01:08:00",
		};

		await db.insert(projectBoardsTable).values(board);
		await db.insert(boardProjectsTable).values(project);
		await db.insert(boardTasksTable).values(task);
		await db.insert(taskAssigneesTable).values([humanAssignee, agentAssignee]);
		await db.insert(taskTagsTable).values(taskTag);
		await db.insert(taskPullRequestsTable).values(taskPr);
		await db.insert(taskExecutionLogsTable).values(executionLog);
		await db.insert(taskExecutionStepsTable).values(executionStep);
		await db.insert(taskCommentsTable).values(taskComment);
		await db.insert(tokenUsageTable).values(taskTokenUsage);

		const [boardRow] = await db
			.select()
			.from(projectBoardsTable)
			.where(eq(projectBoardsTable.id, board.id));
		const [projectRow] = await db
			.select()
			.from(boardProjectsTable)
			.where(eq(boardProjectsTable.id, project.id));
		const [taskRow] = await db
			.select()
			.from(boardTasksTable)
			.where(eq(boardTasksTable.id, task.id));
		const assigneeRows = await db
			.select()
			.from(taskAssigneesTable)
			.where(eq(taskAssigneesTable.taskId, task.id));
		const [tagRow] = await db
			.select()
			.from(taskTagsTable)
			.where(eq(taskTagsTable.id, taskTag.id));
		const [prRow] = await db
			.select()
			.from(taskPullRequestsTable)
			.where(eq(taskPullRequestsTable.id, taskPr.id));
		const [executionLogRow] = await db
			.select()
			.from(taskExecutionLogsTable)
			.where(eq(taskExecutionLogsTable.id, executionLog.id));
		const [executionStepRow] = await db
			.select()
			.from(taskExecutionStepsTable)
			.where(eq(taskExecutionStepsTable.id, executionStep.id));
		const [commentRow] = await db
			.select()
			.from(taskCommentsTable)
			.where(eq(taskCommentsTable.id, taskComment.id));
		const [tokenUsageRow] = await db
			.select()
			.from(tokenUsageTable)
			.where(eq(tokenUsageTable.id, taskTokenUsage.id));

		expect(boardRow?.id).toBe(board.id);
		expect(boardRow?.name).toBe(board.name);
		expect(boardRow?.description).toBe(board.description ?? null);
		expect(boardRow?.ownerId).toBe(board.ownerId);
		expect(projectRow?.id).toBe(project.id);
		expect(projectRow?.boardId).toBe(project.boardId);
		expect(projectRow?.externalProjectId).toBe(
			project.externalProjectId ?? null,
		);
		expect(projectRow?.name).toBe(project.name);
		expect(projectRow?.description).toBe(project.description ?? null);
		expect(projectRow?.repoOwner).toBe(project.repoOwner ?? null);
		expect(projectRow?.repoName).toBe(project.repoName ?? null);
		expect(projectRow?.baseBranch).toBe(project.baseBranch ?? null);
		expect(projectRow?.localFolder).toBe(project.localFolder ?? null);
		expect(projectRow?.lead).toBe(project.lead ?? null);
		expect(projectRow?.category).toBe(project.category ?? null);
		expect(projectRow?.priority).toBe(project.priority ?? null);
		expect(taskRow?.id).toBe(task.id);
		expect(taskRow?.projectId).toBe(task.projectId ?? null);
		expect(taskRow?.title).toBe(task.title);
		expect(taskRow?.content).toBe(task.content);
		expect(taskRow?.dueDate).toBe(task.dueDate ?? null);
		expect(taskRow?.linkedPr).toBe(task.linkedPr ?? null);
		expect(assigneeRows).toHaveLength(2);
		expect(assigneeRows).toContainEqual(humanAssignee);
		expect(assigneeRows).toContainEqual(agentAssignee);
		expect(tagRow?.id).toBe(taskTag.id);
		expect(tagRow?.taskId).toBe(taskTag.taskId);
		expect(tagRow?.tag).toBe(taskTag.tag);
		expect(prRow?.id).toBe(taskPr.id);
		expect(prRow?.repository).toBe(taskPr.repository);
		expect(prRow?.prNumber).toBe(taskPr.prNumber);
		expect(prRow?.prUrl).toBe(taskPr.prUrl ?? null);
		expect(prRow?.branch).toBe(taskPr.branch ?? null);
		expect(executionLogRow?.id).toBe(executionLog.id);
		expect(executionLogRow?.taskId).toBe(executionLog.taskId);
		expect(executionLogRow?.status).toBe(executionLog.status);
		expect(executionLogRow?.finishedAt).toBe(executionLog.finishedAt ?? null);
		expect(executionStepRow?.id).toBe(executionStep.id);
		expect(executionStepRow?.executionLogId).toBe(executionStep.executionLogId);
		expect(executionStepRow?.detail).toBe(executionStep.detail ?? null);
		expect(commentRow?.id).toBe(taskComment.id);
		expect(commentRow?.taskId).toBe(taskComment.taskId);
		expect(commentRow?.comment).toBe(taskComment.comment);
		expect(tokenUsageRow?.id).toBe(taskTokenUsage.id);
		expect(tokenUsageRow?.runId).toBe(taskTokenUsage.runId);
		expect(tokenUsageRow?.taskId).toBe(taskTokenUsage.taskId ?? null);
		expect(tokenUsageRow?.taskExecutionLogId).toBe(
			taskTokenUsage.taskExecutionLogId ?? null,
		);
		expect(tokenUsageRow?.agentBackend).toBe("codex");
		expect(tokenUsageRow?.model).toBe("gpt-5");
		expect(tokenUsageRow?.estimatedCostMicrousd).toBe(5000);
	});

	it("stores and reads project cron job definitions per project", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const { db } = testDatabase;

		const board: NewProjectBoardRow = {
			id: "board-cron-1",
			name: "Automations Board",
			description: "Tracks automation schedules",
			ownerId: "user-1",
			createdAt: "2026-05-12 02:00:00",
			updatedAt: "2026-05-12 02:00:00",
		};
		const project: NewBoardProjectRow = {
			id: "project-cron-1",
			boardId: board.id,
			externalProjectId: "ROY",
			name: "Server Automations",
			description: "Cron jobs for project workflows",
			ownerId: "user-1",
			createdAt: "2026-05-12 02:01:00",
			updatedAt: "2026-05-12 02:01:00",
		};
		const cronJob: NewProjectCronJobRow = {
			id: "cron-1",
			projectId: project.id,
			cronExpression: "0 */2 * * *",
			targetType: "hook",
			target: "review:hourly",
			skills: JSON.stringify(["adhd-plan", "adhd-implement"]),
			enabled: true,
			createdAt: "2026-05-12 02:02:00",
			updatedAt: "2026-05-12 02:02:00",
		};

		await db.insert(projectBoardsTable).values(board);
		await db.insert(boardProjectsTable).values(project);
		await db.insert(projectCronJobsTable).values(cronJob);

		const [cronJobRow] = await db
			.select()
			.from(projectCronJobsTable)
			.where(eq(projectCronJobsTable.id, cronJob.id));

		expect(cronJobRow?.id).toBe(cronJob.id);
		expect(cronJobRow?.projectId).toBe(cronJob.projectId);
		expect(cronJobRow?.cronExpression).toBe(cronJob.cronExpression);
		expect(cronJobRow?.targetType).toBe(cronJob.targetType);
		expect(cronJobRow?.target).toBe(cronJob.target);
		expect(cronJobRow?.skills).toBe(cronJob.skills);
		expect(cronJobRow?.enabled).toBe(cronJob.enabled);
		expect(cronJobRow?.createdAt).toBe(cronJob.createdAt);
		expect(cronJobRow?.updatedAt).toBe(cronJob.updatedAt);
	});

	it("initializes the same database path twice without startup errors", async () => {
		const tempDir = await mkdtemp(
			path.join(os.tmpdir(), "adhd-server-reopen-"),
		);
		const databasePath = path.join(tempDir, "db");
		try {
			const first = await initializeServerDatabase(databasePath);
			await first.close();
			const reopened = await initializeServerDatabase(databasePath);
			await reopened.close();
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("migrates existing token_usage tables created with the old schema", async () => {
		const tempDir = await mkdtemp(
			path.join(os.tmpdir(), "adhd-server-pg-old-"),
		);
		const databasePath = path.join(tempDir, "db");

		try {
			const oldDatabase = await initializeServerDatabase(databasePath, {
				runMigrations: false,
			});
			await oldDatabase.client.query(`
				CREATE TABLE token_usage (
					id text PRIMARY KEY,
					run_id text NOT NULL,
					stage text NOT NULL,
					input_tokens integer NOT NULL,
					output_tokens integer NOT NULL,
					total_tokens integer NOT NULL,
					recorded_at timestamp NOT NULL
				);
			`);
			await oldDatabase.client.query(`
				INSERT INTO token_usage (
					id, run_id, stage, input_tokens, output_tokens, total_tokens, recorded_at
				) VALUES (
					'tu-old-1', 'run-old-1', 'planning', 11, 22, 33, '2026-05-12 03:00:00'
				);
			`);
			await oldDatabase.close();

			const migrated = await initializeServerDatabase(databasePath);
			const [existingRow] = await migrated.db
				.select()
				.from(tokenUsageTable)
				.where(eq(tokenUsageTable.id, "tu-old-1"));

			expect(existingRow?.taskId).toBeNull();
			expect(existingRow?.taskExecutionLogId).toBeNull();
			expect(existingRow?.agentBackend).toBeNull();
			expect(existingRow?.model).toBeNull();
			expect(existingRow?.estimatedCostMicrousd).toBeNull();

			await migrated.db.insert(tokenUsageTable).values({
				id: "tu-old-2",
				runId: "run-old-2",
				taskId: null,
				taskExecutionLogId: null,
				stage: "implement",
				agentBackend: "codex",
				model: "gpt-5",
				inputTokens: 7,
				outputTokens: 8,
				totalTokens: 15,
				estimatedCostMicrousd: 123,
				recordedAt: "2026-05-12 03:10:00",
			});

			const [insertedRow] = await migrated.db
				.select()
				.from(tokenUsageTable)
				.where(eq(tokenUsageTable.id, "tu-old-2"));
			expect(insertedRow?.taskId).toBeNull();
			expect(insertedRow?.taskExecutionLogId).toBeNull();
			expect(insertedRow?.agentBackend).toBe("codex");
			expect(insertedRow?.model).toBe("gpt-5");
			expect(insertedRow?.estimatedCostMicrousd).toBe(123);

			await migrated.close();
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("migrates existing board projects with project metadata columns", async () => {
		const tempDir = await mkdtemp(
			path.join(os.tmpdir(), "adhd-server-pg-project-old-"),
		);
		const databasePath = path.join(tempDir, "db");

		try {
			const oldDatabase = await initializeServerDatabase(databasePath, {
				runMigrations: false,
			});
			await oldDatabase.client.query(`
				CREATE TABLE project_boards (
					id text PRIMARY KEY,
					name text NOT NULL,
					description text,
					owner_id text NOT NULL,
					created_at timestamp NOT NULL,
					updated_at timestamp NOT NULL
				);
				CREATE TABLE board_projects (
					id text PRIMARY KEY,
					board_id text NOT NULL REFERENCES project_boards(id),
					external_project_id text,
					name text NOT NULL,
					description text,
					owner_id text NOT NULL,
					created_at timestamp NOT NULL,
					updated_at timestamp NOT NULL
				);
				INSERT INTO project_boards (
					id, name, description, owner_id, created_at, updated_at
				) VALUES (
					'board-old-1', 'Old Board', NULL, 'user-1',
					'2026-05-20 00:00:00', '2026-05-20 00:00:00'
				);
				INSERT INTO board_projects (
					id, board_id, external_project_id, name, description, owner_id,
					created_at, updated_at
				) VALUES (
					'project-old-1', 'board-old-1', 'ROY', 'Old Project',
					'Old description', 'user-1',
					'2026-05-20 00:01:00', '2026-05-20 00:01:00'
				);
			`);
			await oldDatabase.close();

			const migrated = await initializeServerDatabase(databasePath);
			await migrated.db
				.update(boardProjectsTable)
				.set({
					repoOwner: "octo",
					repoName: "repo",
					baseBranch: "main",
					localFolder: "/tmp/repo",
					lead: "Roy",
					category: "platform",
					priority: 1,
				})
				.where(eq(boardProjectsTable.id, "project-old-1"));

			const [project] = await migrated.db
				.select()
				.from(boardProjectsTable)
				.where(eq(boardProjectsTable.id, "project-old-1"));

			expect(project?.repoOwner).toBe("octo");
			expect(project?.repoName).toBe("repo");
			expect(project?.baseBranch).toBe("main");
			expect(project?.localFolder).toBe("/tmp/repo");
			expect(project?.lead).toBe("Roy");
			expect(project?.category).toBe("platform");
			expect(project?.priority).toBe(1);

			await migrated.close();
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
