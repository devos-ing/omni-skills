import pc from "picocolors";

export const GETSUPERPOWER_ASCII_LOGO = [
  "GETSUPERPOWER",
  "Skill trees for serious agent work.",
].join("\n");

const GETSUPERPOWER_WORDMARK_LINES = [
  "GGGG  EEEEE TTTTT  SSSS  U   U PPPP  EEEEE RRRR  PPPP   OOO  W   W EEEEE RRRR ",
  "G     E       T   S      U   U P   P E     R   R P   P O   O W   W E     R   R",
  "G GGG EEEE    T    SSS   U   U PPPP  EEEE  RRRR  PPPP  O   O W W W EEEE  RRRR ",
  "G   G E       T       S  U   U P     E     R  R  P     O   O WW WW E     R  R ",
  "GGGG  EEEEE   T   SSSS    UUU  P     EEEEE R   R P      OOO  W   W EEEEE R   R",
];

const WORDMARK_MIN_COLUMNS = 78;

function supportsWordmarkLogo(): boolean {
  return (process.stdout.columns ?? 120) >= WORDMARK_MIN_COLUMNS;
}

export function getSuperpowerWordmarkLogo(): string {
  if (!supportsWordmarkLogo()) return GETSUPERPOWER_ASCII_LOGO;

  const [top, high, mid, low, bottom] = GETSUPERPOWER_WORDMARK_LINES;
  return [
    pc.whiteBright(top),
    pc.white(high),
    pc.gray(mid),
    pc.dim(low),
    pc.dim(bottom),
    pc.magenta("____"),
    brand("GETSUPERPOWER"),
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

export function getSuperpowerInstallResultBox(input: {
  workflowName: string;
  workflowVersion: string;
  workflowFile: string;
  skillCount: number;
}): string {
  return brand(
    borderBox([
      GETSUPERPOWER_ASCII_LOGO,
      "",
      `GetSuperpower installed: ${input.workflowName}`,
      `Version: ${input.workflowVersion}`,
      `Skills installed: ${input.skillCount}`,
      `GetSuperpower file: ${input.workflowFile}`,
    ]),
  );
}

export function rootHelpBanner(): string {
  return [
    getSuperpowerWordmarkLogo(),
    "",
    success("Welcome to GetSuperpower."),
    "Install and author workflow skill trees for agent work.",
    "",
    label("Start:"),
    `  ${commandText("getsuperpower init release-review")}`,
    `  ${commandText("getsuperpower validate ./release-review")}`,
    `  ${commandText("getsuperpower install openspec-superpowers")}`,
    `  ${commandText("getsuperpower install ./release-review")}`,
    "",
    label("Inspect:"),
    `  ${commandText("getsuperpower list")}`,
    `  ${commandText("getsuperpower deps ./release-review")}`,
    "",
  ].join("\n");
}

export function styleHelpTitle(title: string): string {
  return brand(title);
}

export function styleHelpTerm(term: string): string {
  return commandText(term);
}
