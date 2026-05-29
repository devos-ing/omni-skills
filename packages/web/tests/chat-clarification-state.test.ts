import { describe, expect, it } from "bun:test";
import {
	isChatClarificationOptionSelected,
	resolveChatClarificationOptionAnswer,
} from "../src/components/chat-room/chat-clarification-option-answer";
import { resolveClarificationAnswerAction } from "../src/components/chat-room/chat-clarification-state";

describe("chat clarification state", () => {
	it("resolves option clicks as immediate advance or submit actions", () => {
		const questions = [
			{
				question: "Which agent?",
				options: [{ label: "Codex", value: "codex" }],
			},
			{
				question: "What scope?",
				options: [{ label: "Web", value: "web" }],
			},
		];

		expect(
			resolveClarificationAnswerAction({
				answerValue: "codex",
				pendingAnswers: [],
				pendingQuestionIndex: 0,
				questions,
			}),
		).toEqual({
			answerDrafts: ["codex"],
			kind: "advance",
			nextQuestionIndex: 1,
		});
		expect(
			resolveClarificationAnswerAction({
				answerValue: "web",
				pendingAnswers: ["codex"],
				pendingQuestionIndex: 1,
				questions,
			}),
		).toEqual({
			answerDrafts: ["codex", "web"],
			answers: [
				{ question: "Which agent?", answer: "codex" },
				{ question: "What scope?", answer: "web" },
			],
			content: "codex\nweb",
			kind: "submit",
		});
	});

	it("returns no action when the current answer is blank or missing", () => {
		expect(
			resolveClarificationAnswerAction({
				answerValue: "   ",
				pendingAnswers: [],
				pendingQuestionIndex: 0,
				questions: [{ question: "Which agent?" }],
			}),
		).toEqual({ kind: "none" });
		expect(
			resolveClarificationAnswerAction({
				pendingAnswers: [],
				pendingQuestionIndex: 2,
				questions: [{ question: "Which agent?" }],
			}),
		).toEqual({ kind: "none" });
	});

	it("uses the visible option label as the chat answer text", () => {
		const option = {
			label: "Use Codex for the web implementation.",
			value: "codex_web",
		};
		const answer = resolveChatClarificationOptionAnswer(option);

		expect(answer).toBe("Use Codex for the web implementation.");
		expect(isChatClarificationOptionSelected(answer, option)).toBe(true);
		expect(isChatClarificationOptionSelected(option.value, option)).toBe(false);
		expect(
			resolveClarificationAnswerAction({
				answerValue: answer,
				pendingAnswers: [],
				pendingQuestionIndex: 0,
				questions: [{ question: "Which approach?", options: [option] }],
			}),
		).toEqual({
			answerDrafts: ["Use Codex for the web implementation."],
			answers: [
				{
					answer: "Use Codex for the web implementation.",
					question: "Which approach?",
				},
			],
			content: "Use Codex for the web implementation.",
			kind: "submit",
		});
	});
});
