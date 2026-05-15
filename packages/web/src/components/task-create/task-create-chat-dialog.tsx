"use client";

import { CheckCircle2, RotateCcw, Send, X } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type {
	TaskCreateChatDialogProps,
	TaskCreateChatState,
} from "./task-create-chat-dialog.types";
import { TaskCreateLogPanel, createLogLine } from "./task-create-log-panel";
import { createInitialState } from "./task-create-state";
import { streamTaskCreate } from "./task-create-stream";

export function TaskCreateChatDialog({
	defaultProjectId,
	onClose,
}: TaskCreateChatDialogProps): ReactElement {
	const [state, setState] = useState<TaskCreateChatState>(() =>
		createInitialState(defaultProjectId),
	);
	const [isStreaming, setIsStreaming] = useState(false);
	const canSubmitRequest = state.request.trim().length > 0 && !isStreaming;
	const canSubmitAnswers =
		state.answers.length > 0 &&
		state.answers.every((answer) => answer.answer.trim().length > 0) &&
		!isStreaming;

	const statusText = useMemo(() => {
		if (isStreaming) {
			return "Creating task and streaming logs...";
		}
		if (state.result) {
			return `Created ${state.result.issue.identifier}`;
		}
		if (state.step === "clarifying") {
			return "Answer the follow-up questions to finish creating the task.";
		}
		return "Describe the task you want created.";
	}, [isStreaming, state.result, state.step]);

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
				projectId: state.projectId.trim(),
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
		<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
			<dialog
				aria-labelledby="task-create-chat-title"
				aria-modal="true"
				className="grid max-h-[100dvh] w-full max-w-2xl gap-4 overflow-auto rounded-lg border border-zinc-800 bg-[#18191d] p-5 text-zinc-100 shadow-2xl"
				open
			>
				<header className="flex items-start justify-between gap-4">
					<div>
						<p className="mb-1 text-xs font-medium uppercase text-zinc-500">
							New Issue
						</p>
						<h2
							className="m-0 text-lg font-semibold"
							id="task-create-chat-title"
						>
							Chat to create a task
						</h2>
						<p className="mb-0 mt-2 text-sm text-zinc-400">{statusText}</p>
					</div>
					<button
						aria-label="Close dialog"
						className="grid h-9 w-9 place-items-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
						onClick={onClose}
						type="button"
					>
						<X size={17} />
					</button>
				</header>
				<div className="grid gap-3">
					<label className="grid gap-1.5 text-sm text-zinc-400">
						<span>Request</span>
						<textarea
							className="issue-input min-h-32 resize-y"
							disabled={state.step === "created" || isStreaming}
							onChange={(event) =>
								setState({ ...state, request: event.target.value })
							}
							placeholder="Describe the issue or task you want created"
							value={state.request}
						/>
					</label>
					<label className="grid gap-1.5 text-sm text-zinc-400">
						<span>Project ID</span>
						<input
							className="issue-input"
							disabled={state.step === "created" || isStreaming}
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
								key={question}
							>
								<span>{question}</span>
								<input
									className="issue-input"
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
							href={state.result.issue.url}
							rel="noreferrer"
							target="_blank"
						>
							{state.result.issue.identifier}
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
					<button
						className="issue-secondary-button"
						onClick={() => setState(createInitialState(defaultProjectId))}
						type="button"
					>
						<RotateCcw size={15} />
						Reset
					</button>
					<div className="flex items-center gap-2">
						<button
							className="issue-secondary-button"
							onClick={onClose}
							type="button"
						>
							Close
						</button>
						{state.step !== "created" ? (
							<button
								className={cn(
									"issue-primary-button",
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
							</button>
						) : null}
					</div>
				</footer>
			</dialog>
		</div>
	);
}
