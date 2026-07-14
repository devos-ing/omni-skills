#!/usr/bin/env node

import { spawn } from "node:child_process";
import { accessSync, constants, existsSync } from "node:fs";
import { access, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const EFFORTS = new Set(["low", "medium", "high", "xhigh"]);
const FLAGS = ["--prompt", "--model", "--effort", "--output"];

export function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!FLAGS.includes(flag)) throw new Error(`Unknown flag: ${flag}`);
    if (values.has(flag)) throw new Error(`Duplicate flag: ${flag}`);
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    values.set(flag, value);
  }

  for (const flag of FLAGS) {
    if (!values.has(flag)) throw new Error(`Missing required flag: ${flag}`);
  }

  const prompt = values.get("--prompt").trim();
  const model = values.get("--model").trim();
  const effort = values.get("--effort").trim();
  const output = values.get("--output").trim();
  if (!prompt) throw new Error("Prompt must not be empty");
  if (!model) throw new Error("Model must not be empty");
  if (!EFFORTS.has(effort)) {
    throw new Error("Effort must be one of: low, medium, high, xhigh");
  }
  if (extname(output).toLowerCase() !== ".png") {
    throw new Error("Output path must end in .png");
  }
  return { prompt, model, effort, output };
}

function pathCandidates(pathValue, names) {
  return (pathValue ?? "")
    .split(delimiter)
    .filter(Boolean)
    .flatMap((directory) => names.map((name) => join(directory, name)));
}

export function browserCandidates({ platform, env }) {
  if (env.CODEX_INPUT_PREVIEW_BROWSER) {
    return [env.CODEX_INPUT_PREVIEW_BROWSER];
  }
  const pathNames =
    platform === "win32"
      ? ["chrome.exe", "msedge.exe", "chromium.exe"]
      : ["google-chrome", "chromium", "chromium-browser", "microsoft-edge"];
  const platformDefaults =
    platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ]
      : platform === "win32"
        ? [
            join(env.PROGRAMFILES ?? "", "Google", "Chrome", "Application", "chrome.exe"),
            join(env["PROGRAMFILES(X86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
          ]
        : [];
  return [...new Set([...platformDefaults, ...pathCandidates(env.PATH, pathNames)])];
}

export function findBrowser(options = {}) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const exists = options.exists ?? existsSync;
  for (const candidate of browserCandidates({ platform, env })) {
    if (!candidate || !exists(candidate)) continue;
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  throw new Error(
    "No supported browser found. Install Chrome, Chromium, or Edge, or set CODEX_INPUT_PREVIEW_BROWSER.",
  );
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildHtml({ prompt, model, effort }) {
  const safePrompt = escapeHtml(prompt);
  const safeModel = escapeHtml(model);
  const safeEffort = escapeHtml(effort);
  return `<!doctype html>
<html lang="en" data-preview-status="pending">
<head>
<meta charset="utf-8">
<style>
*{box-sizing:border-box}
html,body{margin:0;width:1200px;height:675px;overflow:hidden;background:#fff}
body{display:flex;align-items:center;justify-content:center;padding-top:110px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171816}
.composer{width:1105px;min-height:190px;border:1px solid #dededb;border-radius:34px;background:#fff;padding:30px 30px 20px;box-shadow:0 14px 42px rgba(0,0,0,.08)}
.prompt{height:116px;font-size:34px;line-height:1.3;overflow:hidden;overflow-wrap:anywhere}
.footer{display:flex;align-items:center;justify-content:space-between;height:42px;color:#30312f;font-size:20px}
.plus{font-size:34px;font-weight:300;line-height:1}
.actions{display:flex;align-items:center;gap:16px}
.model{display:flex;align-items:center;gap:10px}
.spark{font-size:22px}
.mic{position:relative;width:17px;height:25px;border:2px solid #30312f;border-radius:10px}
.mic::before{content:"";position:absolute;left:50%;bottom:-8px;width:25px;height:13px;transform:translateX(-50%);border:2px solid #30312f;border-top:0;border-radius:0 0 14px 14px}
.mic::after{content:"";position:absolute;left:50%;bottom:-13px;width:2px;height:6px;transform:translateX(-50%);background:#30312f}
.send{display:grid;place-items:center;width:50px;height:50px;border-radius:50%;background:#1c1d1b;color:#fff;font-size:28px}
</style>
</head>
<body>
<main class="composer" aria-label="Simulated Codex input">
  <div class="prompt">${safePrompt}</div>
  <div class="footer">
    <span class="plus" aria-hidden="true">＋</span>
    <div class="actions">
      <span class="model"><span class="spark">✦</span> ${safeModel} · ${safeEffort}</span>
      <span class="mic" aria-hidden="true"></span>
      <span class="send" aria-hidden="true">↑</span>
    </div>
  </div>
</main>
<script>
const prompt = document.querySelector(".prompt");
let fits = false;
for (const size of [34, 30, 26, 22]) {
  prompt.style.fontSize = size + "px";
  if (prompt.scrollHeight <= prompt.clientHeight + 1) {
    fits = true;
    break;
  }
}
document.documentElement.dataset.previewStatus = fits ? "ok" : "overflow";
</script>
</body>
</html>`;
}

export function readPngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error("Browser did not produce a valid PNG");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const COMMON_BROWSER_ARGS = [
  "--headless=new",
  "--disable-background-networking",
  "--disable-extensions",
  "--disable-gpu",
  "--force-device-scale-factor=1",
  "--hide-scrollbars",
  "--no-first-run",
];

function runBrowserProcess(browser, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(browser, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectRun);
    child.on("close", (status) => {
      resolveRun({ status: status ?? 1, stdout, stderr });
    });
  });
}

function browserFailure(result, action) {
  return new Error(`Browser failed to ${action} (exit ${result.status})`);
}

export async function renderPreview(input, dependencies = {}) {
  const output = resolve(input.output);
  await access(dirname(output), constants.W_OK);

  const browser = dependencies.browserPath ?? findBrowser();
  const runBrowser = dependencies.runBrowser ?? runBrowserProcess;
  const workDirectory = await mkdtemp(join(dependencies.tempRoot ?? tmpdir(), "codex-preview-"));
  const htmlPath = join(workDirectory, "preview.html");
  const capturePath = join(
    dirname(output),
    `.${basename(output)}.${process.pid}.${Date.now()}.tmp.png`,
  );

  try {
    await writeFile(htmlPath, buildHtml(input), "utf8");
    const pageUrl = pathToFileURL(htmlPath).href;
    const browserArgs = [
      ...COMMON_BROWSER_ARGS,
      `--user-data-dir=${join(workDirectory, "browser-profile")}`,
    ];
    const fitResult = await runBrowser(browser, [...browserArgs, "--dump-dom", pageUrl]);
    if (fitResult.status !== 0) throw browserFailure(fitResult, "measure the prompt");
    if (fitResult.stdout.includes('data-preview-status="overflow"')) {
      throw new Error("Prompt exceeds four lines. Shorten the prompt and try again.");
    }
    if (!fitResult.stdout.includes('data-preview-status="ok"')) {
      throw new Error("Browser could not verify the prompt layout");
    }

    const captureResult = await runBrowser(browser, [
      ...browserArgs,
      "--window-size=1200,675",
      `--screenshot=${capturePath}`,
      pageUrl,
    ]);
    if (captureResult.status !== 0) throw browserFailure(captureResult, "capture the preview");

    const dimensions = readPngDimensions(await readFile(capturePath));
    if (dimensions.width !== 1200 || dimensions.height !== 675) {
      throw new Error(
        `Expected a 1200 x 675 PNG, received ${dimensions.width} x ${dimensions.height}`,
      );
    }
    await rename(capturePath, output);
    return { output, ...dimensions };
  } finally {
    await rm(capturePath, { force: true });
    await rm(workDirectory, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  try {
    const input = parseArgs(process.argv.slice(2));
    const result = await renderPreview(input);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
