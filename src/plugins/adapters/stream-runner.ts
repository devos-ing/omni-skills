import type { CliInvocation, CliStreamEvent } from "./types";

export async function* streamCliInvocation(
  invocation: CliInvocation,
): AsyncIterable<CliStreamEvent> {
  yield { type: "start", invocation };

  const subprocess = Bun.spawn([invocation.executable, ...invocation.args], {
    stdin: invocation.stdin ? "pipe" : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  if (invocation.stdin && subprocess.stdin) {
    subprocess.stdin.write(`${invocation.stdin}\n`);
    subprocess.stdin.end();
  }

  yield* streamOutputConcurrently([
    { stream: subprocess.stdout, type: "stdout" },
    { stream: subprocess.stderr, type: "stderr" },
  ]);

  yield {
    type: "exit",
    exitCode: await subprocess.exited,
  };
}

interface StreamSource {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  decoder: TextDecoder;
  type: "stdout" | "stderr";
}

type StreamReadResult = Awaited<ReturnType<ReadableStreamDefaultReader<Uint8Array>["read"]>>;

interface PendingStreamRead {
  source: StreamSource;
  result: StreamReadResult;
}

async function* streamOutputConcurrently(
  outputs: Array<{ stream: ReadableStream<Uint8Array>; type: "stdout" | "stderr" }>,
): AsyncIterable<CliStreamEvent> {
  const sources = outputs.map((output) => ({
    reader: output.stream.getReader(),
    decoder: new TextDecoder(),
    type: output.type,
  }));
  const pendingReads = new Map<StreamSource, Promise<PendingStreamRead>>();

  for (const source of sources) {
    pendingReads.set(source, readNext(source));
  }

  try {
    while (pendingReads.size > 0) {
      const read = await Promise.race(pendingReads.values());
      pendingReads.delete(read.source);

      if (read.result.done) {
        const remainder = read.source.decoder.decode();
        if (remainder) {
          yield {
            type: read.source.type,
            chunk: remainder,
          };
        }
        read.source.reader.releaseLock();
        continue;
      }

      yield {
        type: read.source.type,
        chunk: read.source.decoder.decode(read.result.value, { stream: true }),
      };

      pendingReads.set(read.source, readNext(read.source));
    }
  } finally {
    for (const source of pendingReads.keys()) {
      source.reader.releaseLock();
    }
  }
}

async function readNext(source: StreamSource): Promise<PendingStreamRead> {
  return {
    source,
    result: await source.reader.read(),
  };
}
