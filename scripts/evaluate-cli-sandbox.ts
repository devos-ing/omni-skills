import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  renderCliSandboxEvaluation,
  runCliSandboxEvaluation,
} from "../src/testing/cli-sandbox-evaluation";

const outputRoot = join(
  process.cwd(),
  "work",
  "cli-sandbox-evaluation",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

await mkdir(outputRoot, { recursive: true });

const report = await runCliSandboxEvaluation({ sandboxRoot: outputRoot });
const markdown = renderCliSandboxEvaluation(report);

await writeFile(join(outputRoot, "report.md"), markdown);
await writeFile(join(outputRoot, "report.json"), JSON.stringify(report, null, 2));

console.log(markdown);
console.log(`Reports written to ${outputRoot}`);
