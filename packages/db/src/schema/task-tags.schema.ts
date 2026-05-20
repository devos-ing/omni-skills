import { pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { boardTasksTable } from "./board-tasks.schema";

export const taskTagsTable = pgTable(
	"task_tags",
	{
		id: text("id").primaryKey(),
		taskId: text("task_id")
			.notNull()
			.references(() => boardTasksTable.id),
		tag: text("tag").notNull(),
	},
	(table) => ({
		taskTagUnique: uniqueIndex("task_tags_task_tag_unique").on(
			table.taskId,
			table.tag,
		),
	}),
);
