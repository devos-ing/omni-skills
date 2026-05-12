import type { BugRecord } from "../../features/types";

export interface ReviewOutcome {
	passed: boolean;
	summary: string;
	bugs: BugRecord[];
}

export function parseReviewOutcome(text: string): ReviewOutcome {
	const upper = text.toUpperCase();
	const passed =
		upper.includes("RESULT: PASS") && !upper.includes("RESULT: FAIL");
	const summary = extractSummary(text);
	const bugs = extractBugs(text);
	return {
		passed,
		summary,
		bugs: passed ? [] : bugs,
	};
}

function extractSummary(text: string): string {
	const match = text.match(/SUMMARY:\s*([\s\S]*?)(?:\nBUGS_JSON:|$)/i);
	if (match?.[1]) {
		return match[1].trim();
	}
	return text.trim().slice(0, 1200);
}

function extractBugs(text: string): BugRecord[] {
	const jsonFromLabel = text.match(/BUGS_JSON:\s*([\s\S]*)$/i)?.[1]?.trim();
	if (jsonFromLabel) {
		const parsed = parseBugJson(jsonFromLabel);
		if (parsed.length > 0) {
			return parsed;
		}
	}

	const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1]?.trim();
	if (fenced) {
		const parsed = parseBugJson(fenced);
		if (parsed.length > 0) {
			return parsed;
		}
	}

	return [];
}

function parseBugJson(input: string): BugRecord[] {
	try {
		const parsed = JSON.parse(input) as unknown;
		if (Array.isArray(parsed)) {
			return parsed
				.map((item) => {
					if (!item || typeof item !== "object") {
						return null;
					}
					const bug = item as Record<string, unknown>;
					if (typeof bug.title !== "string" || typeof bug.body !== "string") {
						return null;
					}
					return {
						title: bug.title,
						body: bug.body,
					} satisfies BugRecord;
				})
				.filter((item): item is BugRecord => item !== null);
		}
	} catch {
		return [];
	}
	return [];
}
