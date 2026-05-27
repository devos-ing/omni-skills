import type { z } from "zod";

export function parseWithSchema<T>(
	schema: z.ZodType<T> | undefined,
	value: unknown,
	errorPrefix: string,
): T {
	if (!schema) {
		return value as T;
	}
	const result = schema.safeParse(value);
	if (result.success) {
		return result.data;
	}
	throw new Error(`${errorPrefix}: ${formatZodIssues(result.error.issues)}`);
}

function formatZodIssues(issues: z.ZodIssue[]): string {
	return issues
		.map((issue) => {
			const path = issue.path.map(String).join(".");
			return path ? `${path}: ${issue.message}` : issue.message;
		})
		.join("; ");
}
