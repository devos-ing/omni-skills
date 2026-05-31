import { isForeignKeyError } from "../http/http-utils";
import type {
	ProjectRepository,
	ProjectService,
} from "./types/project-service.types";

export function createProjectService(
	repository: ProjectRepository,
): ProjectService {
	return {
		async listProjects() {
			return { status: "ok", value: await repository.listProjects() };
		},
		async getProject(id) {
			const project = await repository.getProject(id);
			return project
				? { status: "ok", value: project }
				: { status: "not_found" };
		},
		async createProject(input) {
			if (!(await repository.boardExists(input.boardId))) {
				return { status: "foreign_key_error" };
			}
			const now = new Date().toISOString();
			try {
				const created = await repository.createProject({
					id: crypto.randomUUID(),
					boardId: input.boardId,
					externalProjectId: input.externalProjectId ?? null,
					name: input.name,
					emoji: input.emoji ?? null,
					description: input.description ?? null,
					repoOwner: input.repoOwner ?? null,
					repoName: input.repoName ?? null,
					baseBranch: input.baseBranch ?? null,
					localFolder: input.localFolder ?? null,
					lead: input.lead ?? null,
					category: input.category ?? null,
					priority: input.priority ?? null,
					ownerId: input.ownerId,
					createdAt: now,
					updatedAt: now,
				});
				return { status: "ok", value: created };
			} catch (error) {
				return isForeignKeyError(error)
					? { status: "foreign_key_error" }
					: { status: "invalid_payload" };
			}
		},
		async updateProject(id, input) {
			if (Object.keys(input).length === 0) {
				return { status: "invalid_payload" };
			}
			if (input.boardId && !(await repository.boardExists(input.boardId))) {
				return { status: "foreign_key_error" };
			}
			try {
				const updated = await repository.updateProject(id, {
					...input,
					updatedAt: new Date().toISOString(),
				});
				return updated
					? { status: "ok", value: updated }
					: { status: "not_found" };
			} catch (error) {
				return isForeignKeyError(error)
					? { status: "foreign_key_error" }
					: { status: "invalid_payload" };
			}
		},
		async deleteProject(id) {
			try {
				const deleted = await repository.deleteProject(id);
				return deleted
					? { status: "ok", value: deleted }
					: { status: "not_found" };
			} catch (error) {
				return isForeignKeyError(error)
					? { status: "foreign_key_error" }
					: { status: "invalid_payload" };
			}
		},
	};
}
