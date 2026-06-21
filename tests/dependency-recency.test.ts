import { describe, expect, test } from "bun:test";
import {
  evaluatePackageRecency,
  formatPackageRecencyResult,
  getPackagePublishDate,
  parsePackageSpecifier,
} from "../src/testing/dependency-recency";

const now = new Date("2026-06-20T00:00:00.000Z");

describe("dependency recency policy", () => {
  test("parses package specifiers without losing scoped package names", () => {
    expect(parsePackageSpecifier("zod")).toEqual({ name: "zod" });
    expect(parsePackageSpecifier("zod@4.2.1")).toEqual({ name: "zod", version: "4.2.1" });
    expect(parsePackageSpecifier("@scope/pkg")).toEqual({ name: "@scope/pkg" });
    expect(parsePackageSpecifier("@scope/pkg@1.2.3")).toEqual({
      name: "@scope/pkg",
      version: "1.2.3",
    });
  });

  test("uses the requested version publish date when a version is specified", () => {
    const publishedAt = getPackagePublishDate(
      {
        "dist-tags": { latest: "2.0.0" },
        time: {
          "1.0.0": "2026-01-01T00:00:00.000Z",
          "2.0.0": "2026-06-15T00:00:00.000Z",
        },
      },
      "1.0.0",
    );

    expect(publishedAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  test("blocks packages published less than 30 days ago", () => {
    const result = evaluatePackageRecency({
      packageName: "new-package",
      publishedAt: new Date("2026-06-01T00:00:00.000Z"),
      now,
      minimumAgeDays: 30,
    });

    expect(result.allowed).toBe(false);
    expect(result.ageDays).toBe(19);
  });

  test("allows packages published at least 30 days ago", () => {
    const result = evaluatePackageRecency({
      packageName: "stable-package",
      publishedAt: new Date("2026-05-21T00:00:00.000Z"),
      now,
      minimumAgeDays: 30,
    });

    expect(result).toEqual({
      packageName: "stable-package",
      allowed: true,
      ageDays: 30,
      minimumAgeDays: 30,
      publishedAt: new Date("2026-05-21T00:00:00.000Z"),
    });
  });

  test("formats blocked package results with the 30 day rule", () => {
    const message = formatPackageRecencyResult({
      packageName: "new-package",
      allowed: false,
      ageDays: 19,
      minimumAgeDays: 30,
      publishedAt: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(message).toContain("new-package");
    expect(message).toContain("19 days old");
    expect(message).toContain("minimum is 30 days");
  });
});
