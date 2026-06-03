import pc from "picocolors";

const RULE = "─".repeat(48);

export function renderCliHeading(
	label: string,
	tone: "danger" | "success" = "success",
): string {
	return `${paintTone("◇", tone)} ${pc.bold(label)}`;
}

export function renderCliRule(): string {
	return pc.cyan(RULE);
}

export function colorizeBanner(banner: string): string {
	return pc.cyan(banner);
}

export function renderCliMutedText(
	text: string,
	colorize: (text: string) => string = pc.gray,
): string {
	return colorize(text);
}

export function renderSummaryBox(
	title: string,
	rows: Array<{ count: number; label: string; tone: "danger" | "success" }>,
): string {
	const visibleRows = rows.filter((row) => row.count > 0);
	const bodyRows = visibleRows.length > 0 ? visibleRows : rows.slice(0, 1);
	const width = Math.max(
		title.length + 8,
		...bodyRows.map((row) => `${row.count} ${row.label}`.length + 4),
	);
	return [
		`${renderCliHeading(title)} ${pc.gray("─┐")}`,
		pc.gray(`│ ${" ".repeat(width - 2)}│`),
		...bodyRows.map((row) => {
			const text = `${row.count} ${row.label}`;
			const padding = " ".repeat(Math.max(width - text.length - 2, 0));
			return `${pc.gray("│")}  ${paintTone(text, row.tone)}${padding}${pc.gray("│")}`;
		}),
		pc.gray(`└${"─".repeat(width - 1)}┘`),
	].join("\n");
}

export function renderCliOutlineBox(title: string, content: string): string {
	const width = Math.max(title.length + 4, content.length + 4);
	const contentPadding = " ".repeat(Math.max(width - content.length - 4, 0));
	return [
		`${renderCliHeading(title)} ${pc.gray("─┐")}`,
		`${pc.gray("│")}  ${content}${contentPadding}  ${pc.gray("│")}`,
		pc.gray(`└${"─".repeat(width - 1)}┘`),
	].join("\n");
}

export function renderKeyValueRows(
	rows: Array<[label: string, value: string, detail?: string]>,
): string {
	const labelWidth = Math.max(...rows.map(([label]) => label.length)) + 2;
	return rows
		.map(([label, value, detail]) =>
			[
				pc.gray(label.padEnd(labelWidth)),
				value,
				detail ? pc.gray(` ${detail}`) : "",
			].join(""),
		)
		.join("\n");
}

export function renderStatusLine(
	status: "fail" | "pass",
	label: string,
	message: string,
): string {
	const marker = status === "pass" ? pc.green("✓") : pc.red("✖");
	const name = status === "pass" ? pc.green(label) : pc.red(label);
	return `${marker} ${name} ${pc.gray("·")} ${message}`;
}

function paintTone(text: string, tone: "danger" | "success"): string {
	return tone === "success" ? pc.green(text) : pc.red(text);
}
