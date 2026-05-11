import type {
	ParsedSkillDocument,
	SkillDocumentFormat,
	SkillDocumentParts,
} from "./types";

export function parseSkillDocument(input: string): ParsedSkillDocument {
	const normalized = input.replace(/\r\n/g, "\n");

	const frontmatterMatch = normalized.match(
		/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/i,
	);
	if (frontmatterMatch) {
		const frontmatterBlock = frontmatterMatch[1] ?? "";
		const body = frontmatterMatch[2] ?? "";
		return {
			title: parseField(frontmatterBlock, "name"),
			description: parseField(frontmatterBlock, "description"),
			content: body.trim(),
			format: "frontmatter",
		};
	}

	const titleMatch = normalized.match(/^name:\s*(.+)$/im);
	const descriptionMatch = normalized.match(/^description:\s*(.+)$/im);
	const bodyMatch = normalized.match(
		/^name:[^\n]*\ndescription:[^\n]*\n\n?([\s\S]*)$/i,
	);
	return {
		title: titleMatch?.[1]?.trim() || "",
		description: descriptionMatch?.[1]?.trim() || "",
		content: bodyMatch?.[1]?.trim() || "",
		format: "plain",
	};
}

function parseField(input: string, fieldName: string): string {
	const match = input.match(new RegExp(`^${fieldName}:\\s*(.+)$`, "im"));
	return match?.[1]?.trim() || "";
}

export function renderSkillDocument(
	input: SkillDocumentParts,
	format: SkillDocumentFormat = "plain",
): string {
	if (format === "frontmatter") {
		return [
			"---",
			`name: ${input.title.trim()}`,
			`description: ${input.description.trim()}`,
			"---",
			"",
			input.content.trim(),
			"",
		].join("\n");
	}

	return [
		`name: ${input.title.trim()}`,
		`description: ${input.description.trim()}`,
		"",
		input.content.trim(),
		"",
	].join("\n");
}
