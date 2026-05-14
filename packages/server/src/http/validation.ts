import type { ValidationResult } from "./validation.types";

export function isObjectRecord(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateObjectBody(
	value: unknown,
	errorMessage = "Malformed request: expected object body",
): ValidationResult<Record<string, unknown>> {
	if (!isObjectRecord(value)) {
		return { status: "error", error: errorMessage };
	}
	return { status: "ok", value };
}

export function validateRequiredNonEmptyString(
	value: unknown,
	errorMessage: string,
): ValidationResult<string> {
	if (typeof value !== "string" || value.trim().length === 0) {
		return { status: "error", error: errorMessage };
	}
	return { status: "ok", value };
}
