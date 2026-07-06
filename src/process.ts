import { spawn } from "node:child_process";

export interface SubprocessCommand {
  executable: string;
  args: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
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
    stdio: ["ignore", "pipe", "pipe"],
  });
  let spawnErrorMessage = "";

  const stdout = readStream(subprocess.stdout);
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

function readStream(stream: NodeJS.ReadableStream | null): Promise<string> {
  if (!stream) {
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}
