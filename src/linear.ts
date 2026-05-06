import {
	LinearClient as LinearSdkClient,
	type Issue as LinearSdkIssue,
	type IssueLabel as LinearSdkIssueLabel,
	type WorkflowState as LinearSdkWorkflowState,
} from "@linear/sdk";
import { normalizeIssueKey } from "./state";
import type {
	LinearIssue,
	ResolvedProjectConfig,
	WorkflowStage,
} from "./types";

type WorkflowLabelStage = keyof ResolvedProjectConfig["linear"]["labelMap"];

interface LinearLabelRecord {
	id: string;
	name: string;
	teamId?: string;
}

export class LinearClient {
	private readonly client: LinearSdkClient;
	private resolvedStatusMap:
		| ResolvedProjectConfig["linear"]["statusMap"]
		| null = null;
	private resolvedWorkflowLabelIds: Partial<
		Record<WorkflowLabelStage, string>
	> = {};
	private workflowLabelIds: string[] = [];
	private workflowLabelsResolved = false;

	constructor(private readonly config: ResolvedProjectConfig) {
		this.client = new LinearSdkClient({
			apiKey: config.linear.apiKey,
			apiUrl: config.linear.apiUrl,
		});
	}

	async fetchWork(issueArg?: string): Promise<LinearIssue[]> {
		await this.ensureResolvedStatusMap();

		if (issueArg) {
			const issue = await this.findIssueByIdentifier(
				normalizeIssueKey(issueArg),
			);
			return issue ? [issue] : [];
		}

		const viewer = await this.client.viewer;
		const assignedIssues = await viewer.assignedIssues({
			first: this.config.linear.pollLimit,
		});
		const includeLabels = Boolean(this.config.linear.requiredLabel);
		const issues = await Promise.all(
			assignedIssues.nodes.map((issue) =>
				this.mapSdkIssueToLinearIssue(issue, includeLabels),
			),
		);

		return sortIssuesByPriority(
			issues
				.filter((issue) => issue.state.id === this.requiredStatusMap().assigned)
				.filter((issue) => {
					if (!this.config.linear.requiredLabel) {
						return true;
					}
					return issue.labels.some(
						(label) =>
							label.name.toLowerCase() ===
							this.config.linear.requiredLabel?.toLowerCase(),
					);
				}),
		);
	}

	async markStage(
		issueId: string,
		stage: keyof ResolvedProjectConfig["linear"]["statusMap"],
	): Promise<void> {
		await this.ensureResolvedStatusMap();
		if (this.config.dryRun) {
			return;
		}
		const stateId = this.requiredStatusMap()[stage];
		await this.client.updateIssue(issueId, { stateId });
	}

	async applyStageLabel(issueId: string, stage: WorkflowStage): Promise<void> {
		if (!isWorkflowLabelStage(stage)) {
			return;
		}
		await this.ensureResolvedWorkflowLabels();
		const nextLabelId = this.resolvedWorkflowLabelIds[stage];
		if (!nextLabelId || this.config.dryRun) {
			return;
		}

		const currentLabelIds = await this.fetchIssueLabelIds(issueId);
		const currentLabelSet = new Set(currentLabelIds);
		const removedLabelIds = this.workflowLabelIds.filter(
			(labelId) => labelId !== nextLabelId && currentLabelSet.has(labelId),
		);
		const addedLabelIds = currentLabelSet.has(nextLabelId) ? [] : [nextLabelId];

		if (addedLabelIds.length === 0 && removedLabelIds.length === 0) {
			return;
		}

		await this.client.updateIssue(issueId, {
			addedLabelIds,
			removedLabelIds,
		});
	}

	async comment(issueId: string, body: string): Promise<void> {
		if (this.config.dryRun) {
			return;
		}
		await this.client.createComment({ issueId, body });
	}

	private async findIssueByIdentifier(
		identifier: string,
	): Promise<LinearIssue | null> {
		let issue: LinearSdkIssue | undefined;
		try {
			issue = await this.client.issue(identifier);
		} catch (error) {
			const message =
				error instanceof Error ? error.message.toLowerCase() : String(error);
			if (
				message.includes("not found") ||
				message.includes("invalid") ||
				message.includes("does not exist")
			) {
				return null;
			}
			throw error;
		}
		if (!issue) {
			return null;
		}
		return this.mapSdkIssueToLinearIssue(issue, true);
	}

	private async ensureResolvedStatusMap(): Promise<void> {
		if (this.resolvedStatusMap) {
			return;
		}

		const workflowStates = await this.client.workflowStates({
			first: 250,
		});
		const states = workflowStates.nodes.filter((state) =>
			this.config.linear.teamId
				? state.teamId === this.config.linear.teamId
				: true,
		);

		const statusMap = this.config.linear.statusMap;
		this.resolvedStatusMap = {
			assigned: this.resolveStatusValue("assigned", statusMap.assigned, states),
			planning: this.resolveStatusValue("planning", statusMap.planning, states),
			implementing: this.resolveStatusValue(
				"implementing",
				statusMap.implementing,
				states,
			),
			pr_created: this.resolveStatusValue(
				"pr_created",
				statusMap.pr_created,
				states,
			),
			reviewing: this.resolveStatusValue(
				"reviewing",
				statusMap.reviewing,
				states,
			),
			testing: this.resolveStatusValue("testing", statusMap.testing, states),
			blocked: this.resolveStatusValue("blocked", statusMap.blocked, states),
			done: this.resolveStatusValue("done", statusMap.done, states),
		};
	}

	private async ensureResolvedWorkflowLabels(): Promise<void> {
		if (this.workflowLabelsResolved) {
			return;
		}

		const configuredEntries = Object.entries(
			this.config.linear.labelMap,
		).filter(([, labelName]) => Boolean(labelName?.trim())) as Array<
			[WorkflowLabelStage, string]
		>;

		if (configuredEntries.length === 0) {
			this.resolvedWorkflowLabelIds = {};
			this.workflowLabelIds = [];
			this.workflowLabelsResolved = true;
			return;
		}

		const labelsConnection = await this.client.issueLabels({
			first: 250,
		});
		const availableLabels = labelsConnection.nodes.map((label) =>
			this.mapSdkLabelToRecord(label),
		);
		const resolved: Partial<Record<WorkflowLabelStage, string>> = {};

		for (const [stage, labelNameRaw] of configuredEntries) {
			const labelName = labelNameRaw.trim();
			let labelId = this.findLabelIdByName(labelName, availableLabels);
			if (!labelId) {
				if (!this.config.linear.autoCreateLabels) {
					throw new Error(
						`Linear label '${labelName}' for stage '${stage}' was not found in project '${this.config.id}'.`,
					);
				}
				const created = await this.createIssueLabel(labelName);
				labelId = created.id;
				availableLabels.push(created);
			}
			resolved[stage] = labelId;
		}

		this.resolvedWorkflowLabelIds = resolved;
		this.workflowLabelIds = Array.from(
			new Set(
				Object.values(resolved).filter(
					(labelId): labelId is string => typeof labelId === "string",
				),
			),
		);
		this.workflowLabelsResolved = true;
	}

	private findLabelIdByName(
		labelName: string,
		labels: LinearLabelRecord[],
	): string | undefined {
		const matches = labels.filter(
			(label) => label.name.toLowerCase() === labelName.toLowerCase(),
		);
		if (matches.length === 0) {
			return undefined;
		}
		if (this.config.linear.teamId) {
			const teamMatch = matches.find(
				(label) => label.teamId === this.config.linear.teamId,
			);
			if (teamMatch) {
				return teamMatch.id;
			}
			const workspaceLabel = matches.find((label) => !label.teamId);
			if (workspaceLabel) {
				return workspaceLabel.id;
			}
		}
		return matches[0]?.id;
	}

	private async createIssueLabel(
		labelName: string,
	): Promise<LinearLabelRecord> {
		const payload = await this.client.createIssueLabel({
			name: labelName,
			teamId: this.config.linear.teamId,
		});
		if (!payload.success) {
			throw new Error(`Failed to create Linear label '${labelName}'.`);
		}

		const issueLabel =
			(await payload.issueLabel) ??
			(payload.issueLabelId
				? await this.client.issueLabel(payload.issueLabelId)
				: undefined);
		if (!issueLabel?.id) {
			throw new Error(`Linear label '${labelName}' was created without an id.`);
		}
		return this.mapSdkLabelToRecord(issueLabel);
	}

	private resolveStatusValue(
		key: keyof ResolvedProjectConfig["linear"]["statusMap"],
		value: string,
		states: LinearSdkWorkflowState[],
	): string {
		const trimmed = value.trim();
		if (isLikelyUuid(trimmed)) {
			return trimmed;
		}
		const found = states.find(
			(state) => state.name.toLowerCase() === trimmed.toLowerCase(),
		);
		if (!found) {
			throw new Error(
				`Unable to resolve Linear status '${trimmed}' for '${key}' in project '${this.config.id}'.`,
			);
		}
		return found.id;
	}

	private requiredStatusMap(): ResolvedProjectConfig["linear"]["statusMap"] {
		if (!this.resolvedStatusMap) {
			throw new Error("Linear status map is not resolved");
		}
		return this.resolvedStatusMap;
	}

	private async mapSdkIssueToLinearIssue(
		issue: LinearSdkIssue,
		includeLabels: boolean,
	): Promise<LinearIssue> {
		const state = await issue.state;
		if (!state?.id) {
			throw new Error(
				`Issue ${issue.identifier} is missing workflow state data.`,
			);
		}
		const labels = includeLabels
			? (await issue.labels()).nodes.map((label) => ({
					id: label.id,
					name: label.name,
				}))
			: [];
		return {
			id: issue.id,
			identifier: issue.identifier,
			title: issue.title,
			url: issue.url,
			priority: {
				value: issue.priority ?? 0,
				name: issue.priorityLabel ?? "No priority",
			},
			state: {
				id: state.id,
				name: state.name,
			},
			labels,
		};
	}

	private async fetchIssueLabelIds(issueId: string): Promise<string[]> {
		const issue = await this.client.issue(issueId);
		if (!issue) {
			return [];
		}
		const labels = await issue.labels();
		return labels.nodes
			.map((label) => label.id)
			.filter((id): id is string => Boolean(id));
	}

	private mapSdkLabelToRecord(label: LinearSdkIssueLabel): LinearLabelRecord {
		return {
			id: label.id,
			name: label.name,
			teamId: label.teamId ?? undefined,
		};
	}
}

function isLikelyUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		value,
	);
}

function isWorkflowLabelStage(
	stage: WorkflowStage,
): stage is WorkflowLabelStage {
	return stage === "pr_created" || stage === "reviewing" || stage === "testing";
}

const PRIORITY_SORT_ORDER: Record<number, number> = {
	1: 0,
	2: 1,
	3: 2,
	4: 3,
	0: 4,
};

function getPriorityRank(priority: number): number {
	return PRIORITY_SORT_ORDER[priority] ?? PRIORITY_SORT_ORDER[0];
}

export function sortIssuesByPriority(issues: LinearIssue[]): LinearIssue[] {
	return issues
		.map((issue, index) => ({ issue, index }))
		.sort((left, right) => {
			const rankDiff =
				getPriorityRank(left.issue.priority.value) -
				getPriorityRank(right.issue.priority.value);
			if (rankDiff !== 0) {
				return rankDiff;
			}
			return left.index - right.index;
		})
		.map((entry) => entry.issue);
}
