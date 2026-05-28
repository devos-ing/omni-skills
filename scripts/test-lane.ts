import { tmpdir } from "node:os";
import path from "node:path";

const SERVER_FAST_TESTS = [
	"packages/server/tests/board-routes.test.ts",
	"packages/server/tests/cli-command-executor-boundary.test.ts",
	"packages/server/tests/cli-routes.test.ts",
	"packages/server/tests/cron-boundary-export.test.ts",
	"packages/server/tests/cron-runtime.test.ts",
	"packages/server/tests/cron-schedule.test.ts",
	"packages/server/tests/express-server-listen.test.ts",
	"packages/server/tests/express-server-validation.test.ts",
	"packages/server/tests/health.test.ts",
	"packages/server/tests/logger.test.ts",
	"packages/server/tests/notifications.test.ts",
	"packages/server/tests/openapi-contract.test.ts",
	"packages/server/tests/project-cron-job-definition.test.ts",
	"packages/server/tests/realtime-events.test.ts",
	"packages/server/tests/recover-server-db.test.ts",
	"packages/server/tests/request-schemas.test.ts",
	"packages/server/tests/response.test.ts",
	"packages/server/tests/server-runtime.test.ts",
	"packages/server/tests/server-services.test.ts",
	"packages/server/tests/startup-paths.test.ts",
	"packages/server/tests/workflow-command-broker.test.ts",
	"packages/server/tests/workflow-command-socket.test.ts",
] as const;

const SERVER_DB_TESTS = [
	"packages/server/tests/agent-configuration-routes.test.ts",
	"packages/server/tests/agent-migration-routes.test.ts",
	"packages/server/tests/agent-skill-routes.test.ts",
	"packages/server/tests/board-repository.test.ts",
	"packages/server/tests/db-boundary-export.test.ts",
	"packages/server/tests/inbox-routes.test.ts",
	"packages/server/tests/linear-task-fields.test.ts",
	"packages/server/tests/polling-db-schema.test.ts",
	"packages/server/tests/polling-status-routes.test.ts",
	"packages/server/tests/project-routes.test.ts",
	"packages/server/tests/server-db-initialization.test.ts",
	"packages/server/tests/server-db-schema.test.ts",
	"packages/server/tests/server-repositories.test.ts",
	"packages/server/tests/server-routes.test.ts",
	"packages/server/tests/task-activity-routes.test.ts",
	"packages/server/tests/task-chat-create.test.ts",
	"packages/server/tests/task-routes.test.ts",
	"packages/server/tests/workflow-data-socket.test.ts",
] as const;

const FAST_TEST_TARGETS = [
	"packages/agent-adapters/tests",
	"packages/create-devos-plugin/tests",
	"packages/workflow/tests",
	"packages/cli/tests",
	"packages/web/tests",
	...SERVER_FAST_TESTS,
] as const;

const DB_TEST_TARGETS = ["packages/db/tests", ...SERVER_DB_TESTS] as const;
const E2E_TEST_ROOT = path.join(import.meta.dir, "../e2e");
const E2E_TEST_TARGETS = ["."] as const;

type TestLane = "coverage" | "db" | "default" | "e2e" | "fast";

const lane = parseLane(process.argv[2]);
const result = await runLane(lane);
process.exitCode = result;

function parseLane(value: string | undefined): TestLane {
	if (
		value === "coverage" ||
		value === "db" ||
		value === "default" ||
		value === "e2e" ||
		value === "fast"
	) {
		return value;
	}
	throw new Error(
		`Unknown test lane '${value ?? ""}'. Expected default, fast, db, e2e, or coverage.`,
	);
}

async function runLane(laneName: TestLane): Promise<number> {
	if (laneName === "default") {
		const fast = await runBunTest([...FAST_TEST_TARGETS]);
		if (fast !== 0) {
			return fast;
		}
		return runDbLane();
	}
	if (laneName === "fast") {
		return runBunTest([...FAST_TEST_TARGETS]);
	}
	if (laneName === "db") {
		return runDbLane();
	}
	if (laneName === "e2e") {
		return runBunTest([...E2E_TEST_TARGETS], { cwd: E2E_TEST_ROOT });
	}
	return runCoverageLane();
}

function runDbLane(): Promise<number> {
	return runBunTest([...DB_TEST_TARGETS], {
		env: {
			CODEX_SANDBOX_NETWORK_DISABLED: "1",
			DEVOS_DB_ENGINE: "pglite",
		},
	});
}

function runCoverageLane(): Promise<number> {
	return runBunTest([...FAST_TEST_TARGETS, ...DB_TEST_TARGETS], {
		coverage: true,
		env: {
			CODEX_SANDBOX_NETWORK_DISABLED: "1",
			DEVOS_DB_ENGINE: "pglite",
		},
	});
}

async function runBunTest(
	targets: string[],
	options: {
		coverage?: boolean;
		cwd?: string;
		env?: Record<string, string>;
	} = {},
): Promise<number> {
	const args = ["test", ...coverageArgs(options.coverage), ...targets];
	const proc = Bun.spawn({
		cmd: ["bun", ...args],
		cwd: options.cwd,
		env: { ...process.env, ...options.env },
		stderr: "inherit",
		stdout: "inherit",
	});
	return proc.exited;
}

function coverageArgs(enabled: boolean | undefined): string[] {
	if (!enabled) {
		return [];
	}
	const coverageDir =
		process.env.DEVOS_COVERAGE_DIR ?? path.join(tmpdir(), "devos-coverage");
	return [
		"--coverage",
		"--coverage-reporter=text",
		"--coverage-reporter=lcov",
		`--coverage-dir=${coverageDir}`,
	];
}
