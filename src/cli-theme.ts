import pc from "picocolors";

export const GETSUPERPOWER_ASCII_LOGO = [
  "GETSUPERPOWER",
  "Skill trees for serious agent work.",
].join("\n");

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

export function rootHelpBanner(): string {
  return [
    brand(GETSUPERPOWER_ASCII_LOGO),
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
