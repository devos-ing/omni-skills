import type { LoadedConfig } from "../../config";

export async function handleProjectsCommand(
	config: LoadedConfig,
): Promise<void> {
	for (const project of config.projects) {
		process.stdout.write(
			`${[
				project.id,
				project.name,
				`exec=${project.executionPath}`,
				`state=${project.workspacePath}`,
			].join("\t")}\n`,
		);
	}
}
