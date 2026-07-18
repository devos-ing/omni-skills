import { describe, expect, test } from "bun:test";
import { copyText } from "../lib/clipboard";

describe("copyText", () => {
  test("returns true only when clipboard writing succeeds", async () => {
    expect(await copyText("command", { writeText: async () => undefined })).toBe(true);
    expect(
      await copyText("command", {
        writeText: async () => {
          throw new Error("denied");
        },
      }),
    ).toBe(false);
    expect(await copyText("command", undefined)).toBe(false);
  });
});
