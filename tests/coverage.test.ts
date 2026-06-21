import { describe, expect, test } from "bun:test";
import { evaluateCoverage, parseLcovCoverage } from "../src/testing/coverage";

describe("coverage threshold", () => {
  test("parses lcov line coverage totals", () => {
    const coverage = parseLcovCoverage(`SF:src/a.ts
LF:10
LH:9
end_of_record
SF:src/b.ts
LF:5
LH:4
end_of_record
`);

    expect(coverage).toEqual({
      coveredLines: 13,
      totalLines: 15,
      percent: 86.66666666666667,
    });
  });

  test("passes at 90 percent and fails below it", () => {
    expect(evaluateCoverage({ coveredLines: 90, totalLines: 100, percent: 90 }, 90)).toEqual({
      passed: true,
      threshold: 90,
      coverage: {
        coveredLines: 90,
        totalLines: 100,
        percent: 90,
      },
    });

    expect(evaluateCoverage({ coveredLines: 89, totalLines: 100, percent: 89 }, 90)).toEqual({
      passed: false,
      threshold: 90,
      coverage: {
        coveredLines: 89,
        totalLines: 100,
        percent: 89,
      },
    });
  });
});
