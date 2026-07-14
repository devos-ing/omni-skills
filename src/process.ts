import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

export interface SubprocessCommand {
  executable: string;
  args: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
  stdin?: string;
  onStdoutLine?: (line: string) => void;
}

export interface SubprocessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runSubprocess(command: SubprocessCommand): Promise<SubprocessResult> {
  const subprocess = spawn(command.executable, command.args, {
    cwd: command.cwd,
    env: command.env,
    stdio: [command.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  if (command.stdin !== undefined) {
    subprocess.stdin?.end(command.stdin);
  }
  let spawnErrorMessage = "";

  const stdout = readStream(subprocess.stdout, command.onStdoutLine);
  const stderr = readStream(subprocess.stderr);
  const exitCode = new Promise<number>((resolve) => {
    subprocess.once("error", (error) => {
      spawnErrorMessage = error.message;
      resolve(127);
    });
    subprocess.once("close", (code) => resolve(code ?? 1));
  });

  const [stdoutText, stderrText, code] = await Promise.all([stdout, stderr, exitCode]);

  return {
    stdout: stdoutText,
    stderr: [stderrText, spawnErrorMessage].filter(Boolean).join("\n"),
    exitCode: code,
  };
}

function readStream(
  stream: NodeJS.ReadableStream | null,
  onLine?: (line: string) => void,
): Promise<string> {
  if (!stream) {
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const decoder = new StringDecoder("utf8");
    let pendingLine = "";
    stream.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buffer);
      if (onLine) {
        const parts = `${pendingLine}${decoder.write(buffer)}`.split(/\r?\n/);
        pendingLine = parts.pop() ?? "";
        for (const line of parts) onLine(line);
      }
    });
    stream.on("error", reject);
    stream.on("end", () => {
      if (onLine) {
        pendingLine += decoder.end();
        if (pendingLine) onLine(pendingLine);
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}
