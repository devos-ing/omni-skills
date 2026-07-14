import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const rendererModulePath =
  "../examples/workflows/codex-input-preview/skills/codex-input-preview/scripts/render-preview.mjs";
const { buildHtml, browserCandidates, findBrowser, parseArgs, readPngDimensions, renderPreview } =
  await import(rendererModulePath);

function pngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe("codex input preview renderer", () => {
  test("parses the four explicit flags", () => {
    expect(
      parseArgs([
        "--prompt",
        "Ship the smallest useful slice",
        "--model",
        "GPT-5.6",
        "--effort",
        "high",
        "--output",
        "./preview.png",
      ]),
    ).toEqual({
      prompt: "Ship the smallest useful slice",
      model: "GPT-5.6",
      effort: "high",
      output: "./preview.png",
    });
  });

  test("rejects missing, unknown, duplicate, and invalid values", () => {
    expect(() => parseArgs([])).toThrow("Missing required flag: --prompt");
    expect(() =>
      parseArgs([
        "--prompt",
        "Prompt",
        "--model",
        "GPT-5.6",
        "--effort",
        "turbo",
        "--output",
        "preview.png",
      ]),
    ).toThrow("Effort must be one of: low, medium, high, xhigh");
    expect(() =>
      parseArgs([
        "--prompt",
        "Prompt",
        "--prompt",
        "Duplicate",
        "--model",
        "GPT-5.6",
        "--effort",
        "high",
        "--output",
        "preview.png",
      ]),
    ).toThrow("Duplicate flag: --prompt");
    expect(() => parseArgs(["--unknown", "value"])).toThrow("Unknown flag: --unknown");
  });

  test("requires png output while preserving free-form model labels", () => {
    expect(() =>
      parseArgs([
        "--prompt",
        "Prompt",
        "--model",
        "Future Codex Model",
        "--effort",
        "xhigh",
        "--output",
        "preview.svg",
      ]),
    ).toThrow("Output path must end in .png");
  });

  test("prefers an explicit browser and includes platform defaults", () => {
    expect(
      browserCandidates({
        platform: "darwin",
        env: { CODEX_INPUT_PREVIEW_BROWSER: "/custom/chrome", PATH: "/bin" },
      }),
    ).toEqual(["/custom/chrome"]);
    expect(browserCandidates({ platform: "darwin", env: { PATH: "/bin" } })).toContain(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    );
    expect(browserCandidates({ platform: "linux", env: { PATH: "/usr/bin:/bin" } })).toContain(
      "/usr/bin/chromium",
    );
    expect(() =>
      findBrowser({ platform: "linux", env: { PATH: "" }, exists: () => false }),
    ).toThrow("No supported browser found");
  });

  test("builds escaped fixed-size HTML with a fit marker", () => {
    const html = buildHtml({
      prompt: "<script>alert('x')</script>",
      model: "GPT & Codex",
      effort: "high",
    });

    expect(html).toContain("width:1200px");
    expect(html).toContain("height:675px");
    expect(html).toContain(".prompt{height:116px");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("GPT &amp; Codex");
    expect(html).toContain('dataset.previewStatus = fits ? "ok" : "overflow"');
    expect(html).not.toContain("<script>alert('x')</script>");
  });

  test("reads exact png dimensions and rejects malformed images", () => {
    expect(readPngDimensions(pngHeader(1200, 675))).toEqual({ width: 1200, height: 675 });
    expect(() => readPngDimensions(Buffer.from("not png"))).toThrow(
      "Browser did not produce a valid PNG",
    );
  });

  test("renders a verified png and removes temporary artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-preview-test-"));
    const output = join(root, "preview.png");
    await writeFile(output, "existing preview");
    try {
      const result = await renderPreview(
        { prompt: "Ship it", model: "GPT-5.6", effort: "high", output },
        {
          browserPath: "/fake/chrome",
          tempRoot: root,
          runBrowser: async (_browser: string, args: string[]) => {
            const screenshot = args.find((arg) => arg.startsWith("--screenshot="));
            if (screenshot) {
              await writeFile(screenshot.slice("--screenshot=".length), pngHeader(1200, 675));
              return { status: 0, stdout: "", stderr: "" };
            }
            return {
              status: 0,
              stdout: '<html data-preview-status="ok"></html>',
              stderr: "",
            };
          },
        },
      );

      expect(result).toEqual({ output, width: 1200, height: 675 });
      expect(readPngDimensions(await readFile(output))).toEqual({ width: 1200, height: 675 });
      expect(await readdir(root)).toEqual(["preview.png"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("preserves an existing destination when the prompt overflows", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-preview-test-"));
    const output = join(root, "preview.png");
    await writeFile(output, "existing preview");
    try {
      await expect(
        renderPreview(
          { prompt: "Too long", model: "GPT-5.6", effort: "high", output },
          {
            browserPath: "/fake/chrome",
            tempRoot: root,
            runBrowser: async () => ({
              status: 0,
              stdout: '<html data-preview-status="overflow"></html>',
              stderr: "",
            }),
          },
        ),
      ).rejects.toThrow("Prompt exceeds four lines");
      expect(await readFile(output, "utf8")).toBe("existing preview");
      expect(await readdir(root)).toEqual(["preview.png"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects incorrect dimensions and removes temporary artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-preview-test-"));
    const output = join(root, "preview.png");
    try {
      await expect(
        renderPreview(
          { prompt: "Ship it", model: "GPT-5.6", effort: "high", output },
          {
            browserPath: "/fake/chrome",
            tempRoot: root,
            runBrowser: async (_browser: string, args: string[]) => {
              const screenshot = args.find((arg) => arg.startsWith("--screenshot="));
              if (screenshot) {
                await writeFile(screenshot.slice("--screenshot=".length), pngHeader(800, 600));
                return { status: 0, stdout: "", stderr: "" };
              }
              return {
                status: 0,
                stdout: '<html data-preview-status="ok"></html>',
                stderr: "",
              };
            },
          },
        ),
      ).rejects.toThrow("Expected a 1200 x 675 PNG, received 800 x 600");
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("reports the browser exit status without dumping unrelated logs", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-preview-test-"));
    const output = join(root, "preview.png");
    try {
      const render = renderPreview(
        { prompt: "Ship it", model: "GPT-5.6", effort: "high", output },
        {
          browserPath: "/fake/chrome",
          tempRoot: root,
          runBrowser: async () => ({
            status: 23,
            stdout: "",
            stderr: "unrelated browser diagnostic noise",
          }),
        },
      );

      await expect(render).rejects.toThrow("Browser failed to measure the prompt (exit 23)");
      await expect(render).rejects.not.toThrow("unrelated browser diagnostic noise");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
