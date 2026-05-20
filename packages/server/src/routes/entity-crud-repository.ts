import { asc, eq } from "devos-db";
import type { ServerDatabase } from "devos-db";
import { agentsTable, skillsTable } from "devos-db";
import type { EntityCrudRepository } from "./entity-crud-service.types";

export function createEntityCrudRepository(
	db: ServerDatabase["db"],
): EntityCrudRepository {
	return {
		async listAgents() {
			return db.select().from(agentsTable).orderBy(asc(agentsTable.id));
		},
		async getAgent(id) {
			const [row] = await db
				.select()
				.from(agentsTable)
				.where(eq(agentsTable.id, id));
			return row ?? null;
		},
		async createAgent(input) {
			const [created] = await db.insert(agentsTable).values(input).returning();
			return created;
		},
		async updateAgent(id, input) {
			const [updated] = await db
				.update(agentsTable)
				.set(input)
				.where(eq(agentsTable.id, id))
				.returning();
			return updated ?? null;
		},
		async deleteAgent(id) {
			const [deleted] = await db
				.delete(agentsTable)
				.where(eq(agentsTable.id, id))
				.returning({ id: agentsTable.id });
			return deleted ?? null;
		},
		async listSkills() {
			return db.select().from(skillsTable).orderBy(asc(skillsTable.id));
		},
		async getSkill(id) {
			const [row] = await db
				.select()
				.from(skillsTable)
				.where(eq(skillsTable.id, id));
			return row ?? null;
		},
		async createSkill(input) {
			const [created] = await db.insert(skillsTable).values(input).returning();
			return created;
		},
		async updateSkill(id, input) {
			const [updated] = await db
				.update(skillsTable)
				.set(input)
				.where(eq(skillsTable.id, id))
				.returning();
			return updated ?? null;
		},
		async deleteSkill(id) {
			const [deleted] = await db
				.delete(skillsTable)
				.where(eq(skillsTable.id, id))
				.returning({ id: skillsTable.id });
			return deleted ?? null;
		},
	};
}
