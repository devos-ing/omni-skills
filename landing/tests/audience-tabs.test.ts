import { describe, expect, test } from "bun:test";
import { nextAudienceIndex } from "../lib/audience-tabs";

describe("nextAudienceIndex", () => {
  test("wraps ArrowRight and ArrowLeft", () => {
    expect(nextAudienceIndex(2, "ArrowRight", 3)).toBe(0);
    expect(nextAudienceIndex(0, "ArrowLeft", 3)).toBe(2);
  });

  test("supports Home and End", () => {
    expect(nextAudienceIndex(1, "Home", 3)).toBe(0);
    expect(nextAudienceIndex(1, "End", 3)).toBe(2);
  });

  test("ignores unrelated keys", () => {
    expect(nextAudienceIndex(1, "Enter", 3)).toBe(1);
  });
});
