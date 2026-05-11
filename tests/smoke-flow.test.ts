import { describe, expect, it } from "bun:test";
import {
	complexPlan,
	failReview,
	issue,
	passReview,
	simplePlan,
	state,
} from "./smoke-fixtures";
import { createSmokeHarness } from "./smoke-harness";

const result = (finalMessage: string, sessionId?: string) => ({
	finalMessage,
	stdout: "",
	sessionId,
	usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
});

describe("deterministic workflow smoke flow", () => {
	it("runs a simple issue through planning, implementation, PR, review, and done", async () => {
		const h = await createSmokeHarness();
		h.addIssue("default", issue("ENG-1"));
		const agent = h.agent("default");
		agent.plans.push(result(simplePlan, "session-1"));
		agent.resumes.push(result("implemented"));
		agent.reviews.push(result(passReview));

		await h.run({ issueArg: "ENG-1" });

		const run = await h.state("default", "ENG-1");
		expect(run?.stage).toBe("done");
		expect(run?.pullRequest?.url).toContain("dry-run");
		expect(h.linear("default").stageCalls.map((c) => c.stage)).toEqual([
			"planning",
			"implementing",
			"pr_created",
			"reviewing",
			"testing",
			"reviewing",
		]);
	});

	it("feeds failed review bugs back through implementation before passing", async () => {
		const h = await createSmokeHarness();
		h.addIssue("default", issue("ENG-2"));
		const agent = h.agent("default");
		agent.plans.push(result(simplePlan, "session-2"));
		agent.resumes.push(result("first pass"), result("fix pass"));
		agent.reviews.push(result(failReview), result(passReview));

		await h.run({ issueArg: "ENG-2" });

		const run = await h.state("default", "ENG-2");
		expect(run?.stage).toBe("done");
		expect(run?.bugs).toEqual([]);
		expect(h.linear("default").comments.join("\n")).toContain(
			"Review/testing failed",
		);
	});

	it("splits complex planner output into child Linear tasks", async () => {
		const h = await createSmokeHarness();
		h.addIssue("default", issue("ENG-3"));
		h.agent("default").plans.push(result(complexPlan, "session-3"));

		await h.run({ issueArg: "ENG-3" });

		expect((await h.state("default", "ENG-3"))?.stage).toBe("done");
		expect(h.linear("default").children).toEqual(["Part A", "Part B"]);
		expect(h.agent("default").resumes).toHaveLength(0);
	});

	it("runs review-only pass for an existing PR", async () => {
		const h = await createSmokeHarness();
		const reviewIssue = issue("ENG-4");
		reviewIssue.state = { id: "reviewing", name: "reviewing" };
		h.addIssue("default", reviewIssue);
		h.agent("default").reviews.push(result(passReview));

		await h.run({ reviewOnly: true });

		const run = await h.state("default", "ENG-4");
		expect(run?.stage).toBe("done");
		expect(run?.reviewMode).toBe("bot");
	});

	it("squash-merges low-complexity completed PRs during review-only runs", async () => {
		const h = await createSmokeHarness();
		const mergeIssue = issue("ENG-5");
		mergeIssue.state = { id: "done", name: "done" };
		h.addIssue("default", mergeIssue);
		const defaultProject = h.project("default");
		defaultProject.dryRun = false;
		await h.presetState("default", state(defaultProject, "ENG-5", "done", 3));

		await h.run({ reviewOnly: true });

		const run = await h.state("default", "ENG-5");
		expect(run?.pullRequestApprovedAt).toBeDefined();
		expect(h.linear("default").stageCalls.at(-1)?.stage).toBe("done");
	});

	it("notifies once when completed PRs require human approval", async () => {
		const h = await createSmokeHarness();
		const humanIssue = issue("ENG-6");
		humanIssue.state = { id: "done", name: "done" };
		h.addIssue("default", humanIssue);
		await h.presetState(
			"default",
			state(h.project("default"), "ENG-6", "done", 8),
		);

		await h.run({ reviewOnly: true });
		await h.run({ reviewOnly: true });

		expect(h.notifications.filter((n) => n.type === "human")).toHaveLength(1);
		expect(
			(await h.state("default", "ENG-6"))?.humanReviewNotifiedAt,
		).toBeDefined();
	});

	it("parks failed review-only runs without implementation session for manual review", async () => {
		const h = await createSmokeHarness();
		const reviewIssue = issue("ENG-7");
		reviewIssue.state = { id: "reviewing", name: "reviewing" };
		h.addIssue("default", reviewIssue);
		h.agent("default").reviews.push(result(failReview));

		await h.run({ reviewOnly: true });

		expect((await h.state("default", "ENG-7"))?.stage).toBe("human_review");
	});

	it("blocks and records outcome when an agent stage fails", async () => {
		const h = await createSmokeHarness();
		h.addIssue("default", issue("ENG-8"));
		h.agent("default").plans.push(new Error("planner exploded"));

		await h.run({ issueArg: "ENG-8" });

		expect((await h.state("default", "ENG-8"))?.stage).toBe("blocked");
		expect(h.linear("default").canceled).toEqual(["lin_ENG-8"]);
		expect(h.notifications).toContainEqual({
			type: "blocked",
			issueKey: "ENG-8",
		});
	});

	it("routes all-project targeted runs to the matching Linear project", async () => {
		const h = await createSmokeHarness();
		h.addIssue("api", issue("API-1", "linear-api"));
		const apiAgent = h.agent("api");
		apiAgent.plans.push(result(simplePlan, "session-api"));
		apiAgent.resumes.push(result("implemented"));
		apiAgent.reviews.push(result(passReview));

		await h.run({ issueArg: "API-1", allProjects: true });

		expect(await h.state("default", "API-1")).toBeNull();
		expect((await h.state("api", "API-1"))?.stage).toBe("done");
	});

	it("executes review-only issues concurrently when run concurrency is configured", async () => {
		const h = await createSmokeHarness();
		const reviewA = issue("ENG-9");
		const reviewB = issue("ENG-10");
		reviewA.state = { id: "reviewing", name: "reviewing" };
		reviewB.state = { id: "reviewing", name: "reviewing" };
		h.addIssue("default", reviewA);
		h.addIssue("default", reviewB);
		const agent = h.agent("default");
		agent.delayMs = 60;
		agent.reviews.push(result(passReview), result(passReview));

		const startedAt = Date.now();
		await h.run({ reviewOnly: true, concurrency: 2 });
		const elapsedMs = Date.now() - startedAt;

		expect((await h.state("default", "ENG-9"))?.stage).toBe("done");
		expect((await h.state("default", "ENG-10"))?.stage).toBe("done");
		expect(elapsedMs).toBeLessThan(180);
	});
});
