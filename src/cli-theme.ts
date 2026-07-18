import pc from "picocolors";

export const OMNISKILLS_ASCII_LOGO = ["OMNISKILLS", "Skill trees for serious agent work."].join(
  "\n",
);

const OMNISKILL_WORDMARK_LINES = [
  " OOO  M   M N   N I SSSS K   K I L     L    SSS ",
  "O   O MM MM NN  N I S    K  K  I L     L   S    ",
  "O   O M M M N N N I  SSS KKK   I L     L    SSS ",
  "O   O M   M N  NN I     S K  K  I L     L       S",
  " OOO  M   M N   N I SSSS K   K I LLLLL LLLLL SSS ",
];

const WORDMARK_MIN_COLUMNS = 78;

function supportsWordmarkLogo(): boolean {
  return (process.stdout.columns ?? 120) >= WORDMARK_MIN_COLUMNS;
}

export function getOmniskillWordmarkLogo(): string {
  if (!supportsWordmarkLogo()) return OMNISKILLS_ASCII_LOGO;

  const [top, high, mid, low, bottom] = OMNISKILL_WORDMARK_LINES;
  return [
    pc.whiteBright(top),
    pc.white(high),
    pc.gray(mid),
    pc.dim(low),
    pc.dim(bottom),
    pc.magenta("____"),
    brand("OMNISKILLS"),
    muted("Skill trees for serious agent work."),
  ].join("\n");
}

export function brand(value: string): string {
  return pc.bold(pc.cyan(value));
}

export function success(value: string): string {
  return pc.bold(pc.green(value));
}

export function warning(value: string): string {
  return pc.yellow(value);
}

export function errorText(value: string): string {
  return pc.red(value);
}

export function muted(value: string): string {
  return pc.dim(value);
}

export function commandText(value: string): string {
  return pc.magenta(value);
}

export function label(value: string): string {
  return muted(value);
}

export function keyValue(key: string, value: string): string {
  return `${label(`${key}:`)} ${value}`;
}

export function nextStep(command: string): string {
  return `${label("Next:")} ${commandText(command)}`;
}

export function borderBox(lines: string[]): string {
  const content = lines.flatMap((line) => line.split("\n"));
  const width = Math.max(...content.map((line) => line.length), 1);
  const horizontal = `+${"-".repeat(width + 2)}+`;
  return [horizontal, ...content.map((line) => `| ${line.padEnd(width)} |`), horizontal].join("\n");
}

export function getOmniskillInstallResultBox(input: {
  workflowName: string;
  workflowVersion: string;
  workflowFile: string;
  skillCount: number;
}): string {
  return brand(
    borderBox([
      OMNISKILLS_ASCII_LOGO,
      "",
      `Omniskills installed: ${input.workflowName}`,
      `Version: ${input.workflowVersion}`,
      `Skills installed: ${input.skillCount}`,
      `Omniskills file: ${input.workflowFile}`,
    ]),
  );
}

export function rootHelpBanner(): string {
  return [
    getOmniskillWordmarkLogo(),
    "",
    success("Welcome to Omniskills."),
    "Install and author workflow skill trees for agent work.",
    "",
    label("Start:"),
    `  ${commandText("omniskill init release-review")}`,
    `  ${commandText("omniskill validate ./release-review")}`,
    `  ${commandText("omniskill install openspec-delivery")}`,
    `  ${commandText("omniskill install ./release-review")}`,
    "",
    label("Inspect:"),
    `  ${commandText("omniskill list")}`,
    `  ${commandText("omniskill deps ./release-review")}`,
    "",
  ].join("\n");
}

export function styleHelpTitle(title: string): string {
  return brand(title);
}

export function styleHelpTerm(term: string): string {
  return commandText(term);
}
