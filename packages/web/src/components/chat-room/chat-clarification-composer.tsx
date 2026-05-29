"use client";

import { type KeyboardEvent, type ReactElement, useState } from "react";

import { ClarificationOptionButton } from "@/components/clarification/clarification-option-button";
import { resolveClarificationStep } from "@/components/clarification/clarification-queue-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";

import {
	isChatClarificationOptionSelected,
	resolveChatClarificationOptionAnswer,
} from "./chat-clarification-option-answer";
import type { ChatClarificationComposerProps } from "./types/chat-room.types";

export function ChatClarificationComposer({
	answers,
	disabled,
	pendingQuestionIndex,
	questions,
	onAnswerChange,
	onSelectOption,
	onSubmit,
}: ChatClarificationComposerProps): ReactElement | null {
	const [isSubmittingOption, setIsSubmittingOption] = useState(false);
	const step = resolveClarificationStep(questions, pendingQuestionIndex);
	const answer = answers[step.currentIndex] ?? "";
	const controlsDisabled = disabled || isSubmittingOption;
	const canSubmit = step.currentQuestion !== null && answer.trim().length > 0;

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
		if (event.key !== "Enter" || !canSubmit || controlsDisabled) {
			return;
		}
		event.preventDefault();
		onSubmit();
	}

	async function handleSelectOption(optionAnswer: string): Promise<void> {
		if (controlsDisabled) return;
		setIsSubmittingOption(true);
		try {
			await onSelectOption(step.currentIndex, optionAnswer);
		} finally {
			setIsSubmittingOption(false);
		}
	}

	if (!step.currentQuestion) {
		return null;
	}

	return (
		<div className="px-4 py-3">
			<div className="mx-auto grid max-w-4xl gap-3 rounded-md border border-border bg-surface-panel p-3">
				<div className="grid gap-2 text-sm">
					<Typography
						as="span"
						id={`clarification-composer-question-${step.currentIndex}`}
					>
						{step.currentQuestion.question}
					</Typography>
					{step.currentQuestion.options?.length ? (
						<div className="flex flex-wrap gap-2">
							{step.currentQuestion.options.map((option) => (
								<ClarificationOptionButton
									disabled={controlsDisabled}
									key={option.value}
									onSelect={() =>
										void handleSelectOption(
											resolveChatClarificationOptionAnswer(option),
										)
									}
									option={option}
									selected={isChatClarificationOptionSelected(answer, option)}
								/>
							))}
						</div>
					) : null}
					<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
						<Input
							aria-labelledby={`clarification-composer-question-${step.currentIndex}`}
							disabled={controlsDisabled}
							id={`clarification-composer-answer-${step.currentIndex}`}
							onChange={(event) =>
								onAnswerChange(step.currentIndex, event.target.value)
							}
							onKeyDown={handleKeyDown}
							placeholder="Type a custom answer"
							value={answer}
						/>
						<Button
							disabled={controlsDisabled || !canSubmit}
							onClick={onSubmit}
							type="button"
						>
							{step.isFinalStep ? "Submit" : "Next"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
