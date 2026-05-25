"use client";

import { CheckCircle2, RotateCcw, Send, X } from "lucide-react";
import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { formatTaskCreateError } from "./task-create-chat-errors";
import { getTaskCreateStatusText } from "./task-create-chat-status";
import { TaskCreateLogPanel, createLogLine } from "./task-create-log-panel";
import { createInitialState } from "./task-create-state";
import { streamTaskCreate } from "./task-create-stream";
import type {
	TaskCreateChatDialogProps,
	TaskCreateChatState,
} from "./types/task-create-chat-dialog.types";

export function TaskCreateChatDialog({
	defaultBoardProjectId,
	onClose,
}: TaskCreateChatDialogProps): ReactElement {
	const [state, setState] = useState<TaskCreateChatState>(() =>
		createInitialState(defaultBoardProjectId),
	);
	const [isStreaming, setIsStreaming] = useState(false);
	const canSubmitRequest = state.request.trim().length > 0 && !isStreaming;
	const canSubmitAnswers =
		state.answers.length > 0 &&
		state.answers.every((answer) => answer.answer.trim().length > 0) &&
		!isStreaming;

	const statusText = getTaskCreateStatusText({
		isStreaming,
		result: state.result,
		step: state.step,
	});

	async function submitTask(nextAnswers = state.answers): Promise<void> {
		setIsStreaming(true);
		setState((current) => ({
			...current,
			errorMessage: null,
			logs: [
				...current.logs,
				createLogLine("system", "Started task creation stream."),
			],
		}));
		try {
			const response = await streamTaskCreate({
				request: state.request.trim(),
				projectId: state.projectId.trim() || undefined,
				answers: nextAnswers.length > 0 ? nextAnswers : undefined,
				onLog: (stream, text) => {
					setState((current) => ({
						...current,
						logs: [...current.logs, createLogLine(stream, text)],
					}));
				},
			});
			if (response.status === "needs_info") {
				setState((current) => ({
					...current,
					answers: response.questions.map((question) => ({
						question,
						answer: "",
					})),
					questions: response.questions,
					step: "clarifying",
				}));
				return;
			}
			if (response.status === "created") {
				setState((current) => ({
					...current,
					answers: [],
					questions: [],
					result: response,
					step: "created",
				}));
				return;
			}
			setState((current) => ({
				...current,
				errorMessage: formatTaskCreateError(response),
			}));
		} catch (error) {
			setState((current) => ({
				...current,
				errorMessage:
					error instanceof Error ? error.message : "Failed to create task",
			}));
		} finally {
			setIsStreaming(false);
		}
	}

	function updateAnswer(index: number, value: string): void {
		setState((current) => ({
			...current,
			answers: current.answers.map((answer, answerIndex) =>
				answerIndex === index ? { ...answer, answer: value } : answer,
			),
		}));
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="max-h-[100dvh] max-w-2xl overflow-auto p-5"
				showCloseButton={false}
			>
				<DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 text-left">
					<div>
						<p className="mb-1 text-xs font-medium uppercase text-zinc-500">
							New Issue
						</p>
						<DialogTitle>Chat to create a task</DialogTitle>
						<p className="mb-0 mt-2 text-sm text-zinc-400">{statusText}</p>
					</div>
					<Button
						aria-label="Close dialog"
						onClick={onClose}
						size="iconLg"
						type="button"
						variant="secondary"
					>
						<X size={17} />
					</Button>
				</DialogHeader>
				<div className="grid gap-3">
					<label
						className="grid gap-1.5 text-sm text-zinc-400"
						htmlFor="task-create-chat-request"
					>
						<span>Request</span>
						<Textarea
							className="min-h-32 resize-y"
							disabled={state.step === "created" || isStreaming}
							id="task-create-chat-request"
							onChange={(event) =>
								setState({ ...state, request: event.target.value })
							}
							placeholder="Describe the issue or task you want created"
							value={state.request}
						/>
					</label>
					<label
						className="grid gap-1.5 text-sm text-zinc-400"
						htmlFor="task-create-chat-project-id"
					>
						<span>Project ID</span>
						<Input
							disabled={state.step === "created" || isStreaming}
							id="task-create-chat-project-id"
							onChange={(event) =>
								setState({ ...state, projectId: event.target.value })
							}
							placeholder="default"
							value={state.projectId}
						/>
					</label>
				</div>
				{state.step === "clarifying" ? (
					<div className="grid gap-3 rounded-lg border border-zinc-800 bg-[#141519] p-3">
						{state.questions.map((question, index) => (
							<label
								className="grid gap-1.5 text-sm text-zinc-400"
								htmlFor={`task-create-chat-answer-${index}`}
								key={question}
							>
								<span>{question}</span>
								<Input
									id={`task-create-chat-answer-${index}`}
									onChange={(event) => updateAnswer(index, event.target.value)}
									placeholder="Type your answer"
									value={state.answers[index]?.answer ?? ""}
								/>
							</label>
						))}
					</div>
				) : null}
				{state.result ? (
					<div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
						<CheckCircle2 size={16} />
						<a
							className="font-medium underline-offset-4 hover:underline"
							href={`#${state.result.task.id}`}
							rel="noreferrer"
						>
							{state.result.task.taskKey}
						</a>
						<span className="text-emerald-200/80">
							Board task {state.result.task.id}
						</span>
					</div>
				) : null}
				<TaskCreateLogPanel logs={state.logs} />
				{state.errorMessage ? (
					<p className="m-0 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
						{state.errorMessage}
					</p>
				) : null}
				<footer className="flex flex-wrap items-center justify-between gap-3">
					<div />
					<div className="flex items-center gap-2">
						<Button onClick={onClose} type="button" variant="secondary">
							Close
						</Button>
						{state.step !== "created" ? (
							<Button
								className={cn(
									(state.step === "clarifying"
										? !canSubmitAnswers
										: !canSubmitRequest) && "opacity-50",
								)}
								disabled={
									state.step === "clarifying"
										? !canSubmitAnswers
										: !canSubmitRequest
								}
								onClick={() => submitTask()}
								type="button"
							>
								<Send size={15} />
								{state.step === "clarifying" ? "Submit Answers" : "Create"}
							</Button>
						) : null}
					</div>
				</footer>
			</DialogContent>
		</Dialog>
	);
}
