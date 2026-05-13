"use client";

import type { ReactElement } from "react";
import { useMemo, useState } from "react";

import { useCreateTaskMutation } from "@/lib/api/queries";

interface ClarificationAnswer {
	question: string;
	answer: string;
}

export function TaskCreatePanel(): ReactElement {
	const createTask = useCreateTaskMutation();
	const [request, setRequest] = useState<string>("");
	const [projectId, setProjectId] = useState<string>("");
	const [answers, setAnswers] = useState<ClarificationAnswer[]>([]);
	const [activeQuestions, setActiveQuestions] = useState<string[]>([]);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const canSubmitInitial = request.trim().length > 0 && !createTask.isPending;
	const canSubmitClarifications =
		activeQuestions.length > 0 &&
		answers.length === activeQuestions.length &&
		answers.every((answer) => answer.answer.trim().length > 0) &&
		!createTask.isPending;

	const statusText = useMemo(() => {
		if (createTask.isPending) {
			return "Submitting task request...";
		}
		if (createTask.data?.status === "created") {
			return `Created ${createTask.data.issue.identifier}`;
		}
		if (createTask.data?.status === "needs_info") {
			return "Additional clarification required.";
		}
		if (errorMessage) {
			return errorMessage;
		}
		return "Enter a requirement to create a task.";
	}, [createTask.data, createTask.isPending, errorMessage]);

	async function submitRequest(
		nextRequest: string,
		nextAnswers?: ClarificationAnswer[],
	): Promise<void> {
		setErrorMessage(null);
		try {
			const response = await createTask.mutateAsync({
				request: nextRequest,
				projectId: projectId.trim() || undefined,
				answers: nextAnswers,
			});
			if (response.status === "needs_info") {
				setActiveQuestions(response.questions);
				setAnswers(
					response.questions.map((question) => ({
						question,
						answer: "",
					})),
				);
				return;
			}
			if (response.status === "created") {
				setActiveQuestions([]);
				setAnswers([]);
				return;
			}
			setErrorMessage(response.error);
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Failed to create task",
			);
		}
	}

	function updateAnswer(index: number, value: string): void {
		setAnswers((current) =>
			current.map((answer, answerIndex) =>
				answerIndex === index ? { ...answer, answer: value } : answer,
			),
		);
	}

	async function handleInitialSubmit(): Promise<void> {
		await submitRequest(request.trim());
	}

	async function handleClarificationSubmit(): Promise<void> {
		await submitRequest(request.trim(), answers);
	}

	return (
		<section
			style={{
				border: "1px solid #cbd5e1",
				borderRadius: "8px",
				background: "#ffffff",
				padding: "1rem",
				width: "100%",
			}}
		>
			<h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Create Task</h2>
			<p style={{ marginTop: 0, color: "#334155" }}>{statusText}</p>
			<label
				htmlFor="task-create-requirement"
				style={{ display: "block", marginBottom: "0.5rem" }}
			>
				Requirement
			</label>
			<textarea
				id="task-create-requirement"
				value={request}
				onChange={(event) => setRequest(event.target.value)}
				placeholder="Describe the task requirement"
				rows={5}
				style={{
					width: "100%",
					resize: "vertical",
					border: "1px solid #94a3b8",
					borderRadius: "6px",
					padding: "0.5rem",
					marginBottom: "0.75rem",
				}}
			/>
			<label
				htmlFor="task-create-project-id"
				style={{ display: "block", marginBottom: "0.5rem" }}
			>
				Project ID (optional)
			</label>
			<input
				id="task-create-project-id"
				type="text"
				value={projectId}
				onChange={(event) => setProjectId(event.target.value)}
				placeholder="default"
				style={{
					width: "100%",
					border: "1px solid #94a3b8",
					borderRadius: "6px",
					padding: "0.5rem",
					marginBottom: "0.75rem",
				}}
			/>
			<button
				type="button"
				onClick={handleInitialSubmit}
				disabled={!canSubmitInitial}
			>
				Submit Requirement
			</button>
			{activeQuestions.length > 0 ? (
				<div style={{ marginTop: "1rem" }}>
					<h3 style={{ marginTop: 0 }}>Clarification Questions</h3>
					{activeQuestions.map((question, index) => (
						<div key={question} style={{ marginBottom: "0.75rem" }}>
							<p style={{ marginTop: 0, marginBottom: "0.5rem" }}>{question}</p>
							<input
								type="text"
								value={answers[index]?.answer ?? ""}
								onChange={(event) => updateAnswer(index, event.target.value)}
								placeholder="Type your answer"
								style={{
									width: "100%",
									border: "1px solid #94a3b8",
									borderRadius: "6px",
									padding: "0.5rem",
								}}
							/>
						</div>
					))}
					<button
						type="button"
						onClick={handleClarificationSubmit}
						disabled={!canSubmitClarifications}
					>
						Submit Answers
					</button>
				</div>
			) : null}
			{createTask.data?.status === "created" ? (
				<p style={{ marginBottom: 0 }}>
					Task link:{" "}
					<a href={createTask.data.issue.url} target="_blank" rel="noreferrer">
						{createTask.data.issue.url}
					</a>
				</p>
			) : null}
		</section>
	);
}
