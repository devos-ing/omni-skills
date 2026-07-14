import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { runSubprocess } from "../src/process";

test("subprocess writes bounded stdin and emits complete stdout lines", async () => {
  const lines: string[] = [];
  const result = await runSubprocess({
    executable: process.execPath,
    args: [
      "-e",
      "process.stdin.on('data', chunk => process.stdout.write(chunk)); process.stdin.on('end', () => process.stdout.write('tail'))",
    ],
    cwd: tmpdir(),
    stdin: "one\ntwo\n",
    onStdoutLine: (line) => lines.push(line),
  });

  expect(result).toEqual({ stdout: "one\ntwo\ntail", stderr: "", exitCode: 0 });
  expect(lines).toEqual(["one", "two", "tail"]);
});
