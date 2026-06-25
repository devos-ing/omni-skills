import type { DetailedRequirement, RequirementCourtResult } from "./requirement-court";

export function renderRequirementCourtMarkdown(result: RequirementCourtResult): string {
  const lines = [`# Pony race: ${result.detailedRequirement.title}`, "", "## Discussion", ""];

  for (const round of result.rounds) {
    lines.push(`### Round ${round.round}`, "");
    for (const entry of round.discussion) {
      lines.push(`- ${entry.line}`);
    }
    lines.push("");
  }

  lines.push("## Visible Thinking Transcript", "");
  for (const round of result.rounds) {
    lines.push(`### Round ${round.round}`, "");
    for (const entry of round.discussion) {
      lines.push(
        `### ${entry.displayName} (${entry.botId})`,
        "",
        `Focus: ${entry.visibleThinking.focus}`,
        "",
        `Concern: ${entry.visibleThinking.concern}`,
        "",
        `Recommendation: ${entry.visibleThinking.recommendation}`,
        "",
        `Vote: ${entry.vote} (${Math.round(entry.confidence * 100)}% confidence)`,
        "",
      );
      pushList(lines, "Required changes", entry.requiredChanges);
    }
  }

  lines.push("## Judge Summary", "", result.judge.summary, "", "## Approval Tally", "");
  for (const vote of result.votes) {
    lines.push(`- ${vote.botId}: ${vote.vote} (${vote.confidence})`);
  }

  lines.push(
    "",
    "## Detailed Requirement",
    "",
    `Title: ${result.detailedRequirement.title}`,
    "",
    `Intent: ${result.detailedRequirement.intent}`,
    "",
  );
  pushList(lines, "Acceptance criteria", result.detailedRequirement.acceptanceCriteria);
  pushList(lines, "Evidence required", result.detailedRequirement.evidenceRequired);
  pushList(lines, "Risks", result.detailedRequirement.risks);
  pushList(lines, "Open questions", result.detailedRequirement.openQuestions);

  lines.push("## Change Summary", "");
  pushList(lines, "What Will Change", getDetailedRequirementChanges(result.detailedRequirement));
  pushList(lines, "What Will Not Change", result.detailedRequirement.exclude);
  lines.push(`Human confirmation: ${result.humanConfirmation}`, "");

  return `${lines.join("\n")}\n`;
}

function getDetailedRequirementChanges(detailedRequirement: DetailedRequirement): string[] {
  return detailedRequirement.include.length > 0
    ? detailedRequirement.include
    : [detailedRequirement.intent];
}

function pushList(lines: string[], label: string, values: string[]): void {
  if (values.length === 0) {
    return;
  }

  lines.push(`### ${label}`, "");
  for (const value of values) {
    lines.push(`- ${value}`);
  }
  lines.push("");
}
