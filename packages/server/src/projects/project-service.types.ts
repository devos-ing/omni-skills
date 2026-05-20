import type { BoardProjectRow, NewBoardProjectRow } from "devos-db";
import type {
	CreateProjectPayload,
	UpdateProjectPayload,
} from "../http/project-task-api.types";

export interface ProjectRepository {
	listProjects(): Promise<BoardProjectRow[]>;
	getProject(id: string): Promise<BoardProjectRow | null>;
	boardExists(id: string): Promise<boolean>;
	createProject(input: NewBoardProjectRow): Promise<BoardProjectRow>;
	updateProject(
		id: string,
		input: Partial<NewBoardProjectRow>,
	): Promise<BoardProjectRow | null>;
	deleteProject(id: string): Promise<BoardProjectRow | null>;
}

export type ProjectServiceResult<T> =
	| { status: "ok"; value: T }
	| { status: "not_found" }
	| { status: "foreign_key_error" }
	| { status: "invalid_payload" };

export interface ProjectService {
	listProjects(): Promise<ProjectServiceResult<BoardProjectRow[]>>;
	getProject(id: string): Promise<ProjectServiceResult<BoardProjectRow>>;
	createProject(
		input: CreateProjectPayload,
	): Promise<ProjectServiceResult<BoardProjectRow>>;
	updateProject(
		id: string,
		input: UpdateProjectPayload,
	): Promise<ProjectServiceResult<BoardProjectRow>>;
	deleteProject(id: string): Promise<ProjectServiceResult<BoardProjectRow>>;
}
