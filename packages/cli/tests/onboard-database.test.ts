import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { instanceConfigPath } from "../src/features/config";
import {
	DEFAULT_LABEL_MAP,
	DEFAULT_REASONING_EFFORTS,
	DEFAULT_STATUS_MAP,
	type OnboardDraft,
	createDefaultOnboardInstanceDraft,
	writeOnboardFiles,
} from "../src/features/onboard";

let draft: OnboardDraft;
let previousHome: string | undefined;
let testHomeDir: string | undefined;

describe("onboard database boundary", () => {
	beforeEach(async () => {
		previousHome = process.env.HOME;
		testHomeDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-onboard-db-home-"),
		);
		process.env.HOME = testHomeDir;
		draft = createTestDraft();
	});

	afterEach(async () => {
		process.env.HOME = previousHome;
		if (testHomeDir) {
			await rm(testHomeDir, { recursive: true, force: true });
		}
		previousHome = undefined;
		testHomeDir = undefined;
	});

	it("does not create or migrate the server database during fresh onboarding", async () => {
		const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-onboard-db-"));
		const repoFallbackDatabasePath = path.join(
			tempDir,
			".devos",
			"config",
			"server-db",
		);

		try {
			await expect(access(repoFallbackDatabasePath)).rejects.toThrow();
			await writeOnboardFiles(tempDir, draft);
			await expect(access(repoFallbackDatabasePath)).rejects.toThrow();

			const instanceConfig = JSON.parse(
				await readFile(instanceConfigPath(), "utf8"),
			) as {
				database: { embeddedPostgresDataDir: string; mode: string };
				workspace: { id: string; name: string };
			};
			expect(instanceConfig.workspace).toEqual({
				id: expect.stringMatching(/^workspace-[a-f0-9]{16}$/),
				name: "Demo Workspace",
			});
			expect(instanceConfig.database.mode).toBe("embedded-postgres");
			await access(instanceConfig.database.embeddedPostgresDataDir);
			expect(
				await readdir(instanceConfig.database.embeddedPostgresDataDir),
			).toEqual([]);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("reruns onboarding without creating server database records", async () => {
		const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-onboard-db-"));
		const repoFallbackDatabasePath = path.join(
			tempDir,
			".devos",
			"config",
			"server-db",
		);

		try {
			await writeOnboardFiles(tempDir, draft);
			const firstInstanceConfig = JSON.parse(
				await readFile(instanceConfigPath(), "utf8"),
			) as {
				workspace: { id: string; name: string };
			};
			await writeOnboardFiles(tempDir, {
				...draft,
				workspaceName: "Renamed Workspace",
			});

			await expect(access(repoFallbackDatabasePath)).rejects.toThrow();
			const instanceConfig = JSON.parse(
				await readFile(instanceConfigPath(), "utf8"),
			) as {
				$meta: { source: string };
				database: { embeddedPostgresDataDir: string };
				workspace: { id: string; name: string };
			};
			expect(instanceConfig.$meta.source).toBe("onboard");
			expect(instanceConfig.workspace).toEqual({
				id: firstInstanceConfig.workspace.id,
				name: "Renamed Workspace",
			});
			expect(
				await readdir(instanceConfig.database.embeddedPostgresDataDir),
			).toEqual([]);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

function createTestDraft(): OnboardDraft {
	return {
		workspaceName: "Demo Workspace",
		workspacePath: "/tmp/demo",
		executionPath: "/tmp/demo",
		instance: createDefaultOnboardInstanceDraft(),
		notifications: {
			email: {
				enabled: false,
				to: [],
			},
		},
		workflow: {
			isolatedWorktrees: true,
		},
		statusMap: DEFAULT_STATUS_MAP,
		labelMap: DEFAULT_LABEL_MAP,
		codex: {
			reasoningEfforts: {
				brainstorm: DEFAULT_REASONING_EFFORTS.brainstorm,
				plan: DEFAULT_REASONING_EFFORTS.plan,
				implement: DEFAULT_REASONING_EFFORTS.implement,
				reviewTest: DEFAULT_REASONING_EFFORTS.reviewTest,
				githubComment: DEFAULT_REASONING_EFFORTS.reviewTest,
			},
			models: {
				brainstorm: "gpt-5.5",
				plan: "gpt-5.5",
				implement: "gpt-5.3-codex",
				reviewTest: "gpt-5.3-codex",
				githubComment: "gpt-5.3-codex",
			},
			plugins: ["github@openai-curated"],
			skillsets: ["devos"],
			configOverrides: { "features.codex_hooks": "true" },
			sandbox: "workspace-write",
		},
	};
}
