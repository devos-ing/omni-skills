import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { boardProjectsTable } from "./board-projects.schema";

export const projectCronJobsTable = pgTable(
	"project_cron_jobs",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => boardProjectsTable.id),
		cronExpression: text("cron_expression").notNull(),
		targetType: text("target_type").notNull(),
		target: text("target").notNull(),
		skills: text("skills").notNull(),
		enabled: boolean("enabled").notNull(),
		createdAt: timestamp("created_at", { mode: "string" }).notNull(),
		updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
	},
	(table) => ({
		projectIndex: index("project_cron_jobs_project_id_idx").on(table.projectId),
	}),
);
