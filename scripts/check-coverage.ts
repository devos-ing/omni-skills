import { readFile } from "node:fs/promises";
import {
  evaluateCoverage,
  formatCoverageEvaluation,
  parseLcovCoverage,
} from "../src/testing/coverage";

const DEFAULT_THRESHOLD = 90;
const DEFAULT_LCOV_PATH = "coverage/lcov.info";

const threshold = parseThreshold(process.argv[2] ?? String(DEFAULT_THRESHOLD));
const lcovPath = process.argv[3] ?? DEFAULT_LCOV_PATH;

const lcov = await readFile(lcovPath, "utf8");
const evaluation = evaluateCoverage(parseLcovCoverage(lcov), threshold);
const message = formatCoverageEvaluation(evaluation);

if (!evaluation.passed) {
  console.error(message);
  process.exit(1);
}

console.log(message);

function parseThreshold(rawValue: string): number {
  const thresholdValue = Number.parseFloat(rawValue);

  if (!Number.isFinite(thresholdValue) || thresholdValue < 0 || thresholdValue > 100) {
    throw new Error(`Coverage threshold must be a number from 0 to 100. Received: ${rawValue}`);
  }

  return thresholdValue;
}
