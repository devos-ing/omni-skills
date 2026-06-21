export interface CoverageSummary {
  coveredLines: number;
  totalLines: number;
  percent: number;
}

export interface CoverageEvaluation {
  passed: boolean;
  threshold: number;
  coverage: CoverageSummary;
}

export function parseLcovCoverage(lcov: string): CoverageSummary {
  let coveredLines = 0;
  let totalLines = 0;

  for (const line of lcov.split("\n")) {
    if (line.startsWith("LH:")) {
      coveredLines += parsePositiveInteger(line, "LH");
    }

    if (line.startsWith("LF:")) {
      totalLines += parsePositiveInteger(line, "LF");
    }
  }

  return {
    coveredLines,
    totalLines,
    percent: totalLines === 0 ? 100 : (coveredLines / totalLines) * 100,
  };
}

export function evaluateCoverage(coverage: CoverageSummary, threshold: number): CoverageEvaluation {
  return {
    passed: coverage.percent >= threshold,
    threshold,
    coverage,
  };
}

export function formatCoverageEvaluation(evaluation: CoverageEvaluation): string {
  const percent = evaluation.coverage.percent.toFixed(2);
  const threshold = evaluation.threshold.toFixed(2);
  const status = evaluation.passed ? "passed" : "failed";

  return `Coverage ${status}: ${percent}% lines (${evaluation.coverage.coveredLines}/${evaluation.coverage.totalLines}), threshold ${threshold}%.`;
}

function parsePositiveInteger(line: string, field: "LH" | "LF"): number {
  const rawValue = line.slice(`${field}:`.length);
  const value = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${field} value: ${rawValue}`);
  }

  return value;
}
