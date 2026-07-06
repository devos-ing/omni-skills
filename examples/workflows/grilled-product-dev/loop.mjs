#!/usr/bin/env node

import { runWorkflowLoopCli } from "./loop-runtime.mjs";

process.exitCode = await runWorkflowLoopCli({
  argv: process.argv.slice(2),
  workflowJson: new URL("./workflow.json", import.meta.url),
});
