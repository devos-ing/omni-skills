import { describe, expect, test } from "bun:test";
import { streamCliInvocation } from "../src/plugins/adapters";
import type { CliStreamEvent } from "../src/plugins/adapters/types";

describe("CLI stream runner", () => {
  test("streams stdin, stdout, stderr, and exit from a child process", async () => {
    const events: CliStreamEvent[] = [];

    for await (const event of streamCliInvocation({
      executable: process.execPath,
      args: [
        "-e",
        "let input = ''; for await (const chunk of process.stdin) input += chunk; console.log(input.trim()); console.error('warn');",
      ],
      stdin: "hello from goal court",
    })) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: "start",
      invocation: {
        executable: process.execPath,
        args: [
          "-e",
          "let input = ''; for await (const chunk of process.stdin) input += chunk; console.log(input.trim()); console.error('warn');",
        ],
        stdin: "hello from goal court",
      },
    });
    expect(
      events
        .filter((event) => event.type === "stdout")
        .map((event) => event.chunk)
        .join(""),
    ).toContain("hello from goal court");
    expect(
      events
        .filter((event) => event.type === "stderr")
        .map((event) => event.chunk)
        .join(""),
    ).toContain("warn");
    expect(events.at(-1)).toEqual({ type: "exit", exitCode: 0 });
  });

  test("streams stderr without waiting for stdout to close", async () => {
    const events: CliStreamEvent[] = [];

    for await (const event of streamCliInvocation({
      executable: process.execPath,
      args: [
        "-e",
        "console.error('early stderr'); setTimeout(() => console.log('late stdout'), 50);",
      ],
    })) {
      events.push(event);
    }

    const firstOutput = events.find((event) => event.type === "stdout" || event.type === "stderr");

    expect(firstOutput).toEqual({
      type: "stderr",
      chunk: expect.stringContaining("early stderr"),
    });
    expect(
      events
        .filter((event) => event.type === "stdout")
        .map((event) => event.chunk)
        .join(""),
    ).toContain("late stdout");
    expect(events.at(-1)).toEqual({ type: "exit", exitCode: 0 });
  });
});
