import { stat } from "node:fs/promises";
import {
	boardProjectsTable,
	inArray,
	initializeServerDatabase,
} from "devos-db";
import type { BoardProjectRow } from "devos-db";
import type { ResolvedProjectConfig } from "../../features/types";

export async function applyDatabaseProjectMetadata(
	projects: ResolvedProjectConfig[],
): Promise<ResolvedProjectConfig[]> {
	if (projects.length === 0) {
		return projects;
	}
	const byDatabasePath = groupProjectsByDatabasePath(projects);
	const rowsByProjectId = new Map<string, BoardProjectRow>();

	for (const [databasePath, databaseProjects] of byDatabasePath) {
		if (!(await pathExists(databasePath))) {
			continue;
		}
		const database = await initializeServerDatabase(databasePath);
		try {
			const rows = await database.db
				.select()
				.from(boardProjectsTable)
				.where(
					inArray(
						boardProjectsTable.id,
						databaseProjects.map((project) => project.id),
					),
				);
			for (const row of rows) {
				rowsByProjectId.set(row.id, row);
			}
		} finally {
			await database.close();
		}
	}

	return projects.map((project) => {
		const metadata = rowsByProjectId.get(project.id);
		return metadata ? applyProjectRow(project, metadata) : project;
	});
}

function groupProjectsByDatabasePath(projects: ResolvedProjectConfig[]) {
	const byPath = new Map<string, ResolvedProjectConfig[]>();
	for (const project of projects) {
		const databasePath = project.server.database.databasePath;
		byPath.set(databasePath, [...(byPath.get(databasePath) ?? []), project]);
	}
	return byPath;
}

function applyProjectRow(
	project: ResolvedProjectConfig,
	row: BoardProjectRow,
): ResolvedProjectConfig {
	const localFolder = row.localFolder ?? undefined;
	return {
		...project,
		name: row.name,
		workspacePath: localFolder ?? project.workspacePath,
		executionPath: localFolder ?? project.executionPath,
		repo: {
			owner: row.repoOwner ?? project.repo.owner,
			name: row.repoName ?? project.repo.name,
			baseBranch: row.baseBranch ?? project.repo.baseBranch,
		},
	};
}

async function pathExists(targetPath: string): Promise<boolean> {
	try {
		await stat(targetPath);
		return true;
	} catch {
		return false;
	}
}
