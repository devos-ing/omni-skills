import { describe, expect, it } from "bun:test";
import type {
	WorkflowMetadata,
	WorkflowPhaseDefinition,
} from "../src/features/workflow/types/workflow-metadata.types";
import { formatWorkflowError } from "../src/features/workflow/utils/error-format";
import {
	findWorkflowPhaseByStage,
	unsupportedWorkflowStageError,
} from "../src/features/workflow/utils/workflow-phase";

describe("workflow utils", () => {
	it("formats unknown workflow errors as stable messages", () => {
		expect(formatWorkflowError(new Error("boom"))).toBe("boom");
		expect(formatWorkflowError("plain failure")).toBe("plain failure");
		expect(formatWorkflowError({ code: "failed", retriable: false })).toBe(
			'{"code":"failed","retriable":false}',
		);

		const circular: Record<string, unknown> = {};
		circular.self = circular;

		expect(formatWorkflowError(circular)).toBe("[object Object]");
	});

	it("finds workflow phases by run state stage", () => {
		const plan = fakePhase("plan", "plan");
		const implement = fakePhase("implement", "in_progress");
		const metadata: WorkflowMetadata = {
			id: "workflow",
			title: "Workflow",
			description: "Workflow",
			phases: [plan, implement],
		};

		expect(findWorkflowPhaseByStage(metadata, "in_progress")).toBe(implement);
		expect(findWorkflowPhaseByStage(metadata, "done")).toBeNull();
	});

	it("creates the existing unsupported stage error message", () => {
		expect(unsupportedWorkflowStageError("done").message).toBe(
			"Unsupported workflow stage: done",
		);
	});
});

function fakePhase(
	id: WorkflowPhaseDefinition["id"],
	stage: WorkflowPhaseDefinition["stage"],
): WorkflowPhaseDefinition {
	return {
		id,
		title: id,
		stage,
		agentAssignments: [],
	};
}
