"use client";

import {
	Bot,
	CalendarDays,
	Circle,
	Clock3,
	GitPullRequest,
	Hash,
	UserRound,
} from "lucide-react";
import type { ReactElement } from "react";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Typography } from "@/components/ui/typography";
import type { ProjectBoardTaskRecord, TokenUsageRecord } from "@/lib/api";
import { useBoardTaskQuery, useTokenUsageQuery } from "@/lib/api/queries";

import { formatOperatorActivityText } from "./issue-activity-display-utils";
import { ExternalLinkValue, formatDateTime } from "./issue-detail-editor-utils";
import {
	MetricRow,
	PanelSection,
	PanelState,
	PropertyRow,
} from "./issue-task-detail-panel-parts";
import {
	formatDueDate,
	summarizeTokenUsage,
} from "./issue-task-detail-panel-utils";
import {
	getPriorityLabel,
	getStatusLabel,
	isAgentTask,
} from "./issues-board-utils";

interface IssueTaskDetailPanelProps {
	taskId: string | null;
	onClose: () => void;
}

type TaskPanelProps = { task: ProjectBoardTaskRecord };

export function IssueTaskDetailPanel({
	taskId,
	onClose,
}: IssueTaskDetailPanelProps): ReactElement {
	const isOpen = Boolean(taskId);
	const taskQuery = useBoardTaskQuery(taskId ?? "", { enabled: isOpen });
	const usageQuery = useTokenUsageQuery({ enabled: isOpen });
	const usageRecords = (usageQuery.data ?? []).filter(
		(record) => record.taskId === taskId,
	);

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<SheetContent
				aria-describedby={undefined}
				className="max-w-[min(28rem,100vw)] overflow-y-auto p-0"
			>
				{renderPanelContent(taskQuery, usageQuery, usageRecords)}
			</SheetContent>
		</Sheet>
	);
}

function renderPanelContent(
	taskQuery: ReturnType<typeof useBoardTaskQuery>,
	usageQuery: ReturnType<typeof useTokenUsageQuery>,
	usageRecords: TokenUsageRecord[],
): ReactElement {
	if (taskQuery.isLoading) {
		return <PanelState label="Loading task" />;
	}
	if (taskQuery.error) {
		return <PanelState label={taskQuery.error.message} />;
	}
	if (!taskQuery.data) {
		return <PanelState label="Task not found" />;
	}
	return (
		<div className="grid gap-5 px-6 pb-8 pt-6">
			<PanelHeader task={taskQuery.data} />
			<TaskProperties task={taskQuery.data} />
			<TaskDetails task={taskQuery.data} />
			<TokenUsageSection
				isLoading={usageQuery.isLoading}
				records={usageRecords}
			/>
		</div>
	);
}

function PanelHeader({ task }: TaskPanelProps): ReactElement {
	const content = formatOperatorActivityText(task.content);
	return (
		<SheetHeader className="pr-8">
			<Typography variant="eyebrow">{task.taskKey}</Typography>
			<SheetTitle className="break-words text-xl leading-7">
				{task.title}
			</SheetTitle>
			{content ? (
				<Typography className="whitespace-pre-wrap leading-6 text-zinc-400">
					{content}
				</Typography>
			) : null}
		</SheetHeader>
	);
}

function TaskProperties({ task }: TaskPanelProps): ReactElement {
	const AssigneeIcon = isAgentTask(task) ? Bot : UserRound;
	return (
		<PanelSection title="Properties">
			<PropertyRow icon={<Circle size={17} />} label="Status">
				{getStatusLabel(task.status)}
			</PropertyRow>
			<PropertyRow icon={<AssigneeIcon size={17} />} label="Assignee">
				{task.assigneeId ?? task.creatorId}
			</PropertyRow>
			<PropertyRow icon={<Hash size={17} />} label="Priority">
				{getPriorityLabel(task.priority)}
			</PropertyRow>
			<PropertyRow icon={<CalendarDays size={17} />} label="Due date">
				{formatDueDate(task.dueDate)}
			</PropertyRow>
			<PropertyRow icon={<GitPullRequest size={17} />} label="Pull request">
				{task.linkedPr ? (
					<ExternalLinkValue href={task.linkedPr} />
				) : (
					"No linked pull request"
				)}
			</PropertyRow>
		</PanelSection>
	);
}

function TaskDetails({ task }: TaskPanelProps): ReactElement {
	return (
		<PanelSection title="Details">
			<PropertyRow icon={<UserRound size={17} />} label="Created by">
				{task.creatorId}
			</PropertyRow>
			<PropertyRow icon={<Clock3 size={17} />} label="Created">
				{formatDateTime(task.createdAt)}
			</PropertyRow>
			<PropertyRow icon={<Clock3 size={17} />} label="Updated">
				{formatDateTime(task.updatedAt)}
			</PropertyRow>
		</PanelSection>
	);
}

function TokenUsageSection({
	isLoading,
	records,
}: {
	isLoading: boolean;
	records: TokenUsageRecord[];
}): ReactElement {
	const summary = summarizeTokenUsage(records);
	return (
		<PanelSection title="Token usage">
			{isLoading ? (
				<Typography variant="description">Loading usage</Typography>
			) : records.length === 0 ? (
				<Typography variant="description">No token usage yet</Typography>
			) : (
				<>
					<MetricRow label="Input" value={summary.inputTokens} />
					<MetricRow label="Output" value={summary.outputTokens} />
					<MetricRow label="Total" value={summary.totalTokens} />
					<MetricRow label="Runs" value={summary.runs} />
				</>
			)}
		</PanelSection>
	);
}
