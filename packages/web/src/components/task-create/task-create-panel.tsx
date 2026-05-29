"use client";

import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ClarificationOptionButton } from "@/components/clarification/clarification-option-button";
import {
	buildClarificationAnswers,
	hasClarificationAnswer,
	resolveClarificationStep,
	updateClarificationAnswer,
} from "@/components/clarification/clarification-queue-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Typography } from "@/components/ui/typography";
import type { TaskClarificationQuestion, TaskCreateAnswer } from "@/lib/api";
import { useCreateTaskMutation } from "@/lib/api/queries";
import { formatTaskCreateError } from "./task-create-chat-errors";

export function TaskCreatePanel(): ReactElement {
	const createTask = useCreateTaskMutation();
	const [request, setRequest] = useState<string>("");
	const [projectId, setProjectId] = useState<string>("default");
	const [answers, setAnswers] = useState<TaskCreateAnswer[]>([]);
	const [activeQuestions, setActiveQuestions] = useState<
		TaskClarificationQuestion[]
	>([]);
	const [clarificationIndex, setClarificationIndex] = useState(0);
	const [submittedAnswers, setSubmittedAnswers] = useState<TaskCreateAnswer[]>(
		[],
	);

	const canSubmitInitial = request.trim().length > 0 && !createTask.isPending;
	const clarificationStep = resolveClarificationStep(
		activeQuestions,
		clarificationIndex,
	);
	const canSubmitClarifications =
		clarificationStep.currentQuestion !== null &&
		hasClarificationAnswer(
			answers.map((answer) => answer.answer),
			clarificationStep.currentIndex,
		) &&
		!createTask.isPending;

	const statusText = useMemo(() => {
		if (createTask.isPending) {
			return "Submitting task request...";
		}
		if (createTask.data?.status === "created") {
			return `Created ${createTask.data.task.taskKey}`;
		}
		if (createTask.data?.status === "needs_info") {
			return "Additional clarification required.";
		}
		return "Enter a requirement to create a task.";
	}, [createTask.data, createTask.isPending]);

	async function submitRequest(
		nextRequest: string,
		nextAnswers?: TaskCreateAnswer[],
	): Promise<void> {
		try {
			const response = await createTask.mutateAsync({
				request: nextRequest,
				projectId: projectId.trim() || undefined,
				answers: nextAnswers,
			});
			if (response.status === "needs_info") {
				setActiveQuestions(response.questions);
				setClarificationIndex(0);
				setSubmittedAnswers(nextAnswers ?? []);
				setAnswers(
					response.questions.map((question) => ({
						question: question.question,
						answer: "",
					})),
				);
				return;
			}
			if (response.status === "created") {
				setActiveQuestions([]);
				setAnswers([]);
				setClarificationIndex(0);
				setSubmittedAnswers([]);
				return;
			}
			toast.error(formatTaskCreateError(response));
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create task",
			);
		}
	}

	function updateAnswer(index: number, value: string): void {
		setAnswers((current) =>
			updateClarificationAnswer(
				current.map((answer) => answer.answer),
				index,
				value,
			).map((answer, answerIndex) => ({
				question: activeQuestions[answerIndex]?.question ?? "",
				answer,
			})),
		);
	}

	async function handleInitialSubmit(): Promise<void> {
		setSubmittedAnswers([]);
		await submitRequest(request.trim(), []);
	}

	async function handleClarificationSubmit(): Promise<void> {
		if (!clarificationStep.currentQuestion || !canSubmitClarifications) {
			return;
		}
		const queuedAnswers = buildClarificationAnswers(
			activeQuestions,
			answers.map((answer) => answer.answer),
		);
		if (!clarificationStep.isFinalStep) {
			setClarificationIndex(clarificationStep.currentIndex + 1);
			return;
		}
		await submitRequest(request.trim(), [
			...submittedAnswers,
			...queuedAnswers,
		]);
	}

	return (
		<section
			style={{
				border: "1px solid hsl(var(--border))",
				borderRadius: "8px",
				background: "hsl(var(--card))",
				color: "#f4f4f5",
				padding: "1rem",
				width: "100%",
			}}
		>
			<Typography className="mb-2" variant="sectionTitle">
				Create Task
			</Typography>
			<Typography variant="description">{statusText}</Typography>
			<Typography
				as="label"
				className="mb-2 block"
				htmlFor="task-create-requirement"
				variant="label"
			>
				Requirement
			</Typography>
			<Textarea
				className="mb-3 min-h-32 resize-y"
				id="task-create-requirement"
				value={request}
				onChange={(event) => setRequest(event.target.value)}
				placeholder="Describe the task requirement"
				rows={5}
			/>
			<Typography
				as="label"
				className="mb-2 block"
				htmlFor="task-create-project-id"
				variant="label"
			>
				Project ID
			</Typography>
			<Input
				className="mb-3"
				id="task-create-project-id"
				type="text"
				value={projectId}
				onChange={(event) => setProjectId(event.target.value)}
				placeholder="default"
			/>
			<Button
				type="button"
				onClick={handleInitialSubmit}
				disabled={!canSubmitInitial}
			>
				Submit Requirement
			</Button>
			{activeQuestions.length > 0 ? (
				<div style={{ marginTop: "1rem" }}>
					<Typography variant="cardTitle">Clarification Question</Typography>
					{clarificationStep.currentQuestion ? (
						<div
							key={clarificationStep.currentQuestion.question}
							style={{ marginBottom: "0.75rem" }}
						>
							<Typography className="mb-2">
								{clarificationStep.currentQuestion.question}
							</Typography>
							{clarificationStep.currentQuestion.options?.length ? (
								<div className="mb-2 flex flex-wrap gap-2">
									{clarificationStep.currentQuestion.options.map((option) => (
										<ClarificationOptionButton
											key={option.value}
											onSelect={() =>
												updateAnswer(
													clarificationStep.currentIndex,
													option.value,
												)
											}
											option={option}
											selected={
												answers[clarificationStep.currentIndex]?.answer ===
												option.value
											}
										/>
									))}
								</div>
							) : null}
							<Input
								type="text"
								value={answers[clarificationStep.currentIndex]?.answer ?? ""}
								onChange={(event) =>
									updateAnswer(
										clarificationStep.currentIndex,
										event.target.value,
									)
								}
								placeholder="Type a custom answer"
							/>
						</div>
					) : null}
					<Button
						type="button"
						onClick={handleClarificationSubmit}
						disabled={!canSubmitClarifications}
					>
						{clarificationStep.isFinalStep ? "Submit Answer" : "Next"}
					</Button>
				</div>
			) : null}
			{createTask.data?.status === "created" ? (
				<Typography>Task key: {createTask.data.task.taskKey}</Typography>
			) : null}
		</section>
	);
}
