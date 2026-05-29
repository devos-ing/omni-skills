"use client";

import type { ReactElement } from "react";

import { ClarificationOptionButton } from "@/components/clarification/clarification-option-button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import type { TaskClarificationQuestion } from "@/lib/api";

export interface TaskCreateClarificationStepProps {
	answer: string;
	currentIndex: number;
	question: TaskClarificationQuestion;
	onAnswerChange: (index: number, value: string) => void;
}

export function TaskCreateClarificationStep({
	answer,
	currentIndex,
	question,
	onAnswerChange,
}: TaskCreateClarificationStepProps): ReactElement {
	return (
		<Typography
			as="label"
			className="grid gap-1.5 text-zinc-400"
			htmlFor={`task-create-chat-answer-${currentIndex}`}
			variant="label"
		>
			<Typography as="span" className="text-zinc-400" variant="label">
				{question.question}
			</Typography>
			{question.options?.length ? (
				<div className="flex flex-wrap gap-2">
					{question.options.map((option) => (
						<ClarificationOptionButton
							key={option.value}
							onSelect={() => onAnswerChange(currentIndex, option.value)}
							option={option}
							selected={answer === option.value}
						/>
					))}
				</div>
			) : null}
			<Input
				id={`task-create-chat-answer-${currentIndex}`}
				onChange={(event) => onAnswerChange(currentIndex, event.target.value)}
				placeholder="Type a custom answer"
				value={answer}
			/>
		</Typography>
	);
}
