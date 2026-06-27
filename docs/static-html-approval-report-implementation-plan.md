# Static HTML Approval Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-contained static HTML approval report beside each generated Ponytrail Markdown requirement report.

**Architecture:** Keep the CLI thin. Add a pure runtime HTML renderer, add an HTML path helper next to the existing Markdown helper, and make the current report-writing CLI path write both `.md` and `.html` artifacts from the same `RequirementCourtResult`.

**Tech Stack:** Bun tests, TypeScript, Commander CLI, Node `fs/promises`, inline CSS, no browser framework, no external assets, no new dependencies.

---

## File Structure

- Create: `src/runtimes/ponytrail/html-report.ts`
  - Pure renderer for a self-contained approval-focused HTML document.
  - Owns HTML escaping and display-only markup.
- Modify: `src/runtimes/ponytrail/requirement-report.ts`
  - Add `htmlReportPath` to text report options.
  - Add `createRequirementCourtHtmlReportPath`.
  - Share report-path stem creation between Markdown and HTML helpers.
- Modify: `src/runtimes/ponytrail/index.ts`
  - Export the HTML renderer.
- Modify: `src/cli.ts`
  - Import HTML renderer and helper.
  - Replace `writeMarkdownReport` with a report writer that writes Markdown and HTML together.
  - Print `HTML approval report: ...` after the Markdown report path.
- Create: `tests/html-report.test.ts`
  - Unit tests for HTML content and escaping.
- Modify: `tests/requirement-report.test.ts`
  - Unit tests for HTML path generation and text-report output.
- Modify: `tests/cli.test.ts`
  - Integration tests for generated `.html` artifacts in default and custom Markdown paths.

## Testing Strategy

Test this at four levels:

1. Renderer unit test: `rtk bun test tests/html-report.test.ts`
   - Proves the approval packet contains the expected sections and escapes unsafe text.
2. Report helper test: `rtk bun test tests/requirement-report.test.ts`
   - Proves Markdown and HTML path helpers produce the same timestamp/title stem with different extensions.
3. CLI integration test: `rtk bun test tests/cli.test.ts`
   - Proves the user-facing `ponyrace` command writes and prints the `.html` artifact.
4. Full gate and smoke check:
   - `rtk bun run check`
   - Scratch CLI run under `work/` that creates a real `.html` file.

---

### Task 1: Add HTML Renderer Tests And Renderer

**Files:**
- Create: `tests/html-report.test.ts`
- Create: `src/runtimes/ponytrail/html-report.ts`
- Modify: `src/runtimes/ponytrail/index.ts`

- [ ] **Step 1: Write the failing renderer tests**

Create `tests/html-report.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { draftGoalContract } from "../src/runtimes/ponytrail/goal";
import { createDefaultManifest } from "../src/runtimes/ponytrail/manifest";
import type { RequirementCourtResult } from "../src/runtimes/ponytrail/requirement-court";
import { renderRequirementCourtHtml } from "../src/runtimes/ponytrail/html-report";

describe("requirement court HTML approval report", () => {
  test("renders the approval-focused review sections", () => {
    const result = createCourtResult();

    const html = renderRequirementCourtHtml(result);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Approve: Add CSV import to admin dashboard</title>");
    expect(html).toContain("Should I approve this?");
    expect(html).toContain("What exactly changes?");
    expect(html).toContain("How will we know it worked?");
    expect(html).toContain("What did the review bots say?");
    expect(html).toContain("What happens next?");
    expect(html).toContain("Will change");
    expect(html).toContain("Add CSV import to admin dashboard");
    expect(html).toContain("Will not change");
    expect(html).toContain("Do not add billing import");
    expect(html).toContain("Acceptance criteria");
    expect(html).toContain("CSV import is covered by tests");
    expect(html).toContain("Evidence required");
    expect(html).toContain("rtk bun test tests/csv-import.test.ts");
    expect(html).toContain("Product Manager Bot");
    expect(html).toContain("approve");
    expect(html).toContain("80%");
    expect(html).toContain("local deterministic pony");
    expect(html).toContain("brainstorm");
    expect(html).toContain("human approval");
    expect(html).toContain("implementation");
    expect(html).toContain("verification");
  });

  test("escapes user and model text before inserting it into HTML", () => {
    const result = createCourtResult({
      title: "Render <script>alert(\"x\")</script> approval",
      intent: "Keep <img src=x onerror=alert(1)> inert",
      include: ["Add CSV import & validation"],
      exclude: ["Do not render <b>raw HTML</b>"],
      risks: ["Risk <b>scope creep</b> & regressions"],
      openQuestions: ["Should <button>approve</button> stay text?"],
      botMessage: "Concern uses <svg onload=alert(1)>",
    });

    const html = renderRequirementCourtHtml(result);

    expect(html).toContain("Render &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; approval");
    expect(html).toContain("Keep &lt;img src=x onerror=alert(1)&gt; inert");
    expect(html).toContain("Add CSV import &amp; validation");
    expect(html).toContain("Do not render &lt;b&gt;raw HTML&lt;/b&gt;");
    expect(html).toContain("Risk &lt;b&gt;scope creep&lt;/b&gt; &amp; regressions");
    expect(html).toContain("Should &lt;button&gt;approve&lt;/button&gt; stay text?");
    expect(html).toContain("Concern uses &lt;svg onload=alert(1)&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<svg onload");
    expect(html).not.toContain("<button>approve</button>");
  });
});

function createCourtResult(
  overrides: {
    title?: string;
    intent?: string;
    include?: string[];
    exclude?: string[];
    risks?: string[];
    openQuestions?: string[];
    botMessage?: string;
  } = {},
): RequirementCourtResult {
  const manifest = createDefaultManifest();
  const title = overrides.title ?? "Add CSV import to admin dashboard";
  const intent = overrides.intent ?? "Add CSV import to admin dashboard";
  const draft = draftGoalContract(title, { manifest });
  const entry = {
    botId: "product_manager_bot",
    displayName: "Product Manager Bot",
    role: "Product",
    round: 1,
    message: overrides.botMessage ?? "This matches the admin import workflow.",
    visibleThinking: {
      focus: "Intent alignment",
      concern: overrides.botMessage ?? "Keep the upload scope narrow.",
      recommendation: "Approve with focused CSV evidence.",
    },
    run: { mode: "local" as const },
    line: "product_manager_bot: I think this is ready.",
    vote: "approve" as const,
    confidence: 0.8,
    evidence: ["Skill-guided evidence"],
    requiredChanges: ["Keep billing import out of scope"],
  };
  const vote = {
    botId: "product_manager_bot",
    vote: "approve" as const,
    confidence: 0.8,
    reason: "Matches intent.",
    requiredChanges: [],
  };
  const verdict = {
    approved: true,
    approvals: 4,
    amendments: 0,
    rejections: 0,
    requiredChanges: [],
    missingVoters: [],
  };

  return {
    rawRequest: title,
    clarifiedRequest: intent,
    draft,
    rounds: [{ round: 1, discussion: [entry], votes: [vote], verdict }],
    discussion: [entry],
    votes: [vote],
    verdict,
    judge: {
      botId: "requirement_judge_bot",
      summary: "Approvals: 4/4. Ready for owner approval.",
      verdict: "approved",
    },
    detailedRequirement: {
      title,
      intent,
      include: overrides.include ?? ["Add CSV import to admin dashboard"],
      exclude: overrides.exclude ?? ["Do not add billing import"],
      acceptanceCriteria: ["CSV import is covered by tests"],
      evidenceRequired: ["rtk bun test tests/csv-import.test.ts"],
      risks: overrides.risks ?? ["Import parsing may reject valid edge cases."],
      openQuestions: overrides.openQuestions ?? [],
    },
    humanConfirmation: "pending",
  };
}
```

- [ ] **Step 2: Run the renderer tests and verify they fail**

Run:

```bash
rtk bun test tests/html-report.test.ts
```

Expected: FAIL because `src/runtimes/ponytrail/html-report.ts` does not exist or `renderRequirementCourtHtml` is not exported.

- [ ] **Step 3: Implement the HTML renderer**

Create `src/runtimes/ponytrail/html-report.ts`:

```ts
import type {
  RequirementCourtResult,
  RequirementCourtRound,
  RequirementDiscussionEntry,
} from "./requirement-court";
import { formatRequirementPonyRun, getDetailedRequirementChanges } from "./requirement-report";

export function renderRequirementCourtHtml(result: RequirementCourtResult): string {
  const title = result.detailedRequirement.title;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Approve: ${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fa;
      --panel: #ffffff;
      --ink: #1f2933;
      --muted: #667085;
      --line: #d9dee7;
      --accent: #2563eb;
      --approve: #157347;
      --amend: #9a6700;
      --reject: #b42318;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(1120px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }
    header, section, article {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    header {
      padding: 28px;
      margin-bottom: 18px;
    }
    section {
      padding: 22px;
      margin-top: 18px;
    }
    h1, h2, h3 {
      margin: 0;
      line-height: 1.2;
    }
    h1 {
      font-size: 32px;
      letter-spacing: 0;
    }
    h2 { font-size: 22px; }
    h3 { font-size: 17px; }
    p { margin: 10px 0 0; }
    ul {
      margin: 12px 0 0;
      padding-left: 22px;
    }
    li + li { margin-top: 6px; }
    .muted { color: var(--muted); }
    .status-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 4px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #f9fafb;
      font-size: 14px;
      color: var(--muted);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .checklist, .timeline {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }
    .check {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfcfe;
    }
    .check-mark {
      color: var(--approve);
      font-weight: 700;
    }
    .needs-review .check-mark {
      color: var(--amend);
    }
    .round {
      margin-top: 16px;
      padding: 0;
      border: 0;
      background: transparent;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
      margin-top: 12px;
    }
    .card {
      padding: 16px;
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }
    .vote-approve { color: var(--approve); }
    .vote-amend { color: var(--amend); }
    .vote-reject { color: var(--reject); }
    .timeline {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
    .step {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fbfcfe;
      min-height: 72px;
    }
    .step strong {
      display: block;
    }
    @media (max-width: 760px) {
      main {
        width: min(100% - 20px, 1120px);
        padding-top: 20px;
      }
      h1 { font-size: 26px; }
      .grid, .timeline {
        grid-template-columns: 1fr;
      }
    }
    @media print {
      body { background: #ffffff; }
      main { width: 100%; padding: 0; }
      header, section, article { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="muted">Ponytrail approval packet</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(result.detailedRequirement.intent)}</p>
      <div class="status-row">
        <span class="pill">Human confirmation: ${escapeHtml(result.humanConfirmation)}</span>
        <span class="pill">Review verdict: ${result.verdict.approved ? "approved" : "not approved"}</span>
        <span class="pill">Approvals: ${result.verdict.approvals}</span>
      </div>
    </header>

    <section>
      <h2>Should I approve this?</h2>
      <p class="muted">Approve only if the scope, evidence, and remaining risks match the intended change.</p>
      ${renderApprovalChecklist(result)}
    </section>

    <section>
      <h2>What exactly changes?</h2>
      <div class="grid">
        ${renderListPanel("Will change", getDetailedRequirementChanges(result.detailedRequirement))}
        ${renderListPanel("Will not change", result.detailedRequirement.exclude)}
      </div>
    </section>

    <section>
      <h2>How will we know it worked?</h2>
      <div class="grid">
        ${renderListPanel("Acceptance criteria", result.detailedRequirement.acceptanceCriteria)}
        ${renderListPanel("Evidence required", result.detailedRequirement.evidenceRequired)}
      </div>
    </section>

    <section>
      <h2>Risks and open questions</h2>
      <div class="grid">
        ${renderListPanel("Risks", result.detailedRequirement.risks)}
        ${renderListPanel("Open questions", result.detailedRequirement.openQuestions)}
      </div>
    </section>

    <section>
      <h2>What did the review bots say?</h2>
      ${result.rounds.map(renderRound).join("\\n")}
    </section>

    <section>
      <h2>What happens next?</h2>
      <div class="timeline">
        ${["brainstorm", "plan", "human approval", "implementation", "verification"]
          .map((step, index) => `<div class="step"><strong>${index + 1}. ${step}</strong><span class="muted">${renderTimelineCaption(step)}</span></div>`)
          .join("\\n")}
      </div>
    </section>
  </main>
</body>
</html>
`;
}

function renderApprovalChecklist(result: RequirementCourtResult): string {
  const checks = [
    {
      label: "Clear intended change",
      met: getDetailedRequirementChanges(result.detailedRequirement).length > 0,
    },
    { label: "Clear exclusions", met: result.detailedRequirement.exclude.length > 0 },
    {
      label: "Acceptance criteria",
      met: result.detailedRequirement.acceptanceCriteria.length > 0,
    },
    { label: "Evidence required", met: result.detailedRequirement.evidenceRequired.length > 0 },
    { label: "Review-bot approval", met: result.verdict.approved },
    {
      label: "Known risks and open questions reviewed",
      met: result.detailedRequirement.risks.length > 0 || result.detailedRequirement.openQuestions.length === 0,
    },
  ];

  return `<div class="checklist">${checks.map(renderCheck).join("\\n")}</div>`;
}

function renderCheck(check: { label: string; met: boolean }): string {
  const className = check.met ? "check" : "check needs-review";
  const mark = check.met ? "✓" : "!";

  return `<div class="${className}"><span class="check-mark">${mark}</span><span>${escapeHtml(check.label)}</span></div>`;
}

function renderListPanel(title: string, values: string[]): string {
  return `<article class="card">
    <h3>${escapeHtml(title)}</h3>
    ${renderList(values)}
  </article>`;
}

function renderList(values: string[]): string {
  if (values.length === 0) {
    return `<p class="muted">None.</p>`;
  }

  return `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

function renderRound(round: RequirementCourtRound): string {
  return `<section class="round">
    <h3>Round ${round.round}</h3>
    <div class="cards">
      ${round.discussion.map(renderDiscussionEntry).join("\\n")}
    </div>
  </section>`;
}

function renderDiscussionEntry(entry: RequirementDiscussionEntry): string {
  return `<article class="card">
    <div class="card-head">
      <div>
        <h3>${escapeHtml(entry.displayName)}</h3>
        <p class="muted">${escapeHtml(entry.botId)} · ${escapeHtml(entry.role)}</p>
      </div>
      <strong class="vote-${entry.vote}">${escapeHtml(entry.vote)} · ${Math.round(entry.confidence * 100)}%</strong>
    </div>
    <p><strong>Focus:</strong> ${escapeHtml(entry.visibleThinking.focus)}</p>
    <p><strong>Concern:</strong> ${escapeHtml(entry.visibleThinking.concern)}</p>
    <p><strong>Recommendation:</strong> ${escapeHtml(entry.visibleThinking.recommendation)}</p>
    <p><strong>Run:</strong> ${escapeHtml(formatRequirementPonyRun(entry.run))}</p>
    ${renderListPanel("Evidence", entry.evidence)}
    ${renderListPanel("Required changes", entry.requiredChanges)}
  </article>`;
}

function renderTimelineCaption(step: string): string {
  const captions: Record<string, string> = {
    brainstorm: "Clarify the request and review direction.",
    plan: "Turn the approved design into implementation tasks.",
    "human approval": "Owner confirms the plan before work starts.",
    implementation: "Workers make the approved changes.",
    verification: "Evidence proves the change is ready.",
  };

  return captions[step] ?? "";
}

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return value.replace(/[&<>"']/gu, (character) => replacements[character] ?? character);
}
```

- [ ] **Step 4: Export the renderer**

Modify `src/runtimes/ponytrail/index.ts` by adding this export near the existing runtime exports:

```ts
export * from "./html-report";
```

- [ ] **Step 5: Run the renderer tests and verify they pass**

Run:

```bash
rtk bun test tests/html-report.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
rtk git add src/runtimes/ponytrail/html-report.ts src/runtimes/ponytrail/index.ts tests/html-report.test.ts
rtk git commit -m "feat: render html approval report"
```

---

### Task 2: Add HTML Report Paths And Text Output

**Files:**
- Modify: `src/runtimes/ponytrail/requirement-report.ts`
- Modify: `tests/requirement-report.test.ts`

- [ ] **Step 1: Update the report tests first**

Modify the import in `tests/requirement-report.test.ts`:

```ts
import {
  createRequirementCourtHtmlReportPath,
  createRequirementCourtMarkdownReportPath,
  formatRequirementCourtReportPathForOutput,
  renderRequirementCourtTextReport,
} from "../src/runtimes/ponytrail/requirement-report";
```

Update the first test options and expected sections:

```ts
const lines = renderRequirementCourtTextReport(result, {
  discussionHeading: "Pony race",
  includeVisibleThinking: true,
  markdownReportPath: ".ponyrace/ponyrace/report.md",
  htmlReportPath: ".ponyrace/ponyrace/report.html",
});

const orderedSections = [
  "Pony race",
  "Round 1",
  "Visible thinking transcript",
  "Judge summary",
  "Markdown report: .ponyrace/ponyrace/report.md",
  "HTML approval report: .ponyrace/ponyrace/report.html",
  "Final votes",
  "Detailed requirement",
  "Human confirmation: pending",
].map((section) => lines.findIndex((line) => line.includes(section)));
```

Update the deterministic path test:

```ts
const markdownReportPath = createRequirementCourtMarkdownReportPath(
  rootDir,
  result,
  new Date("2026-06-25T09:30:00Z"),
);
const htmlReportPath = createRequirementCourtHtmlReportPath(
  rootDir,
  result,
  new Date("2026-06-25T09:30:00Z"),
);

expect(markdownReportPath).toBe(
  join(
    rootDir,
    ".ponyrace",
    "ponyrace",
    "2026-06-25T09-30-00Z-add-csv-import-to-admin-dashboard.md",
  ),
);
expect(htmlReportPath).toBe(
  join(
    rootDir,
    ".ponyrace",
    "ponyrace",
    "2026-06-25T09-30-00Z-add-csv-import-to-admin-dashboard.html",
  ),
);
expect(formatRequirementCourtReportPathForOutput(rootDir, markdownReportPath)).toBe(
  ".ponyrace/ponyrace/2026-06-25T09-30-00Z-add-csv-import-to-admin-dashboard.md",
);
expect(formatRequirementCourtReportPathForOutput(rootDir, htmlReportPath)).toBe(
  ".ponyrace/ponyrace/2026-06-25T09-30-00Z-add-csv-import-to-admin-dashboard.html",
);
expect(formatRequirementCourtReportPathForOutput(rootDir, "/tmp/outside-report.md")).toBe(
  "/tmp/outside-report.md",
);
```

- [ ] **Step 2: Run the report tests and verify they fail**

Run:

```bash
rtk bun test tests/requirement-report.test.ts
```

Expected: FAIL because `htmlReportPath` and `createRequirementCourtHtmlReportPath` do not exist yet.

- [ ] **Step 3: Implement path and text-output support**

Modify `src/runtimes/ponytrail/requirement-report.ts`:

```ts
export interface RequirementCourtTextReportOptions {
  discussionHeading?: string | undefined;
  includeVisibleThinking?: boolean | undefined;
  markdownReportPath?: string | undefined;
  htmlReportPath?: string | undefined;
  style?: RequirementCourtTextReportStyle | undefined;
}
```

Add the HTML line after the Markdown line in `renderRequirementCourtTextReport`:

```ts
if (options.markdownReportPath) {
  lines.push(`Markdown report: ${options.markdownReportPath}`);
}
if (options.htmlReportPath) {
  lines.push(`HTML approval report: ${options.htmlReportPath}`);
}
```

Replace `createRequirementCourtMarkdownReportPath` with shared path creation:

```ts
export function createRequirementCourtMarkdownReportPath(
  rootDir: string,
  result: RequirementCourtResult,
  timestamp: Date = new Date(),
): string {
  return createRequirementCourtReportPath(rootDir, result, "md", timestamp);
}

export function createRequirementCourtHtmlReportPath(
  rootDir: string,
  result: RequirementCourtResult,
  timestamp: Date = new Date(),
): string {
  return createRequirementCourtReportPath(rootDir, result, "html", timestamp);
}

function createRequirementCourtReportPath(
  rootDir: string,
  result: RequirementCourtResult,
  extension: "md" | "html",
  timestamp: Date,
): string {
  const timestampSlug = timestamp
    .toISOString()
    .replace(/\.\d{3}Z$/u, "Z")
    .replace(/[:]/gu, "-");

  return join(
    rootDir,
    ".ponyrace",
    "ponyrace",
    `${timestampSlug}-${slugifyRequirementCourtReportTitle(
      result.detailedRequirement.title,
    )}.${extension}`,
  );
}
```

- [ ] **Step 4: Run the report tests and verify they pass**

Run:

```bash
rtk bun test tests/requirement-report.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the renderer tests again**

Run:

```bash
rtk bun test tests/html-report.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
rtk git add src/runtimes/ponytrail/requirement-report.ts tests/requirement-report.test.ts
rtk git commit -m "feat: add html report paths"
```

---

### Task 3: Write HTML Reports From The CLI

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Update the CLI tests first**

In `tests/cli.test.ts`, update the test named `ponyrace writes the default markdown report under .ponyrace after the summary` so it asserts both artifacts:

```ts
const markdownLineIndex = lines.findIndex((line) => line.startsWith("Markdown report: "));
const htmlLineIndex = lines.findIndex((line) => line.startsWith("HTML approval report: "));
const finalVotesIndex = lines.findIndex((line) => line.includes("Final votes"));
const markdownPath = lines[markdownLineIndex]?.replace("Markdown report: ", "") ?? "";
const htmlPath = lines[htmlLineIndex]?.replace("HTML approval report: ", "") ?? "";

expect(markdownPath.startsWith(".ponyrace/ponyrace/")).toBe(true);
expect(markdownPath.endsWith("-add-csv-import-to-admin-dashboard.md")).toBe(true);
expect(htmlPath.startsWith(".ponyrace/ponyrace/")).toBe(true);
expect(htmlPath.endsWith("-add-csv-import-to-admin-dashboard.html")).toBe(true);
expect(markdownLineIndex).toBeGreaterThan(judgeSummaryIndex);
expect(htmlLineIndex).toBe(markdownLineIndex + 1);
expect(htmlLineIndex).toBeLessThan(finalVotesIndex);

const markdownReport = await readFile(join(rootDir, markdownPath), "utf8");
expect(markdownReport).toContain("# Pony race: Add CSV import to admin dashboard");
expect(markdownReport).toContain("Human confirmation: pending");

const htmlReport = await readFile(join(rootDir, htmlPath), "utf8");
expect(htmlReport).toContain("<!doctype html>");
expect(htmlReport).toContain("Should I approve this?");
expect(htmlReport).toContain("What exactly changes?");
expect(htmlReport).toContain("Human confirmation: pending");
```

In the test named `ponyrace writes a markdown discussion report with pony thinking and change summary`, add HTML sibling assertions after reading the Markdown report:

```ts
const htmlReport = await readFile(join(rootDir, "outputs", "ponyrace-report.html"), "utf8");

expect(stripAnsiLines(logs)).toContain(`Markdown report: ${reportPath}`);
expect(stripAnsiLines(logs)).toContain("HTML approval report: outputs/ponyrace-report.html");
expect(htmlReport).toContain("<title>Approve: Add CSV import to admin dashboard</title>");
expect(htmlReport).toContain("What did the review bots say?");
expect(htmlReport).toContain("Product Manager Bot");
```

- [ ] **Step 2: Run the CLI tests and verify they fail**

Run:

```bash
rtk bun test tests/cli.test.ts
```

Expected: FAIL because the CLI does not write or print HTML reports yet.

- [ ] **Step 3: Import HTML helpers in the CLI**

Modify the runtime import list in `src/cli.ts`:

```ts
  createRequirementCourtHtmlReportPath,
  createRequirementCourtMarkdownReportPath,
  renderRequirementCourtHtml,
  renderRequirementCourtMarkdown,
```

Modify the Node path import at the top of `src/cli.ts`:

```ts
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
```

- [ ] **Step 4: Replace Markdown-only artifact writing with paired report writing**

Replace `printRequirementCourtResultAndArtifacts`, `writeMarkdownReport`, and `RequirementCourtOutputOptions` in `src/cli.ts` with:

```ts
interface RequirementCourtReportPaths {
  markdown?: string | undefined;
  html?: string | undefined;
}

async function printRequirementCourtResultAndArtifacts(
  result: RequirementCourtResult,
  input: RunGoalFlowInput,
): Promise<void> {
  const reportPaths = await writeRequirementCourtReports(result, input);

  printRequirementCourtResult(result, {
    discussionHeading: input.discussionHeading,
    printVisibleThinking: input.printVisibleThinking,
    markdownReportPath: reportPaths.markdown,
    htmlReportPath: reportPaths.html,
  });
}

async function writeRequirementCourtReports(
  result: RequirementCourtResult,
  input: RunGoalFlowInput,
): Promise<RequirementCourtReportPaths> {
  if (!input.markdownReport) {
    return {};
  }

  const timestamp = new Date();
  const markdownReportPath = input.markdownReport.path
    ? resolvePath(input.rootDir, input.markdownReport.path)
    : createRequirementCourtMarkdownReportPath(input.rootDir, result, timestamp);
  const htmlReportPath = input.markdownReport.path
    ? replacePathExtension(markdownReportPath, ".html")
    : createRequirementCourtHtmlReportPath(input.rootDir, result, timestamp);

  await mkdir(dirname(markdownReportPath), { recursive: true });
  await writeFile(markdownReportPath, renderRequirementCourtMarkdown(result));
  await mkdir(dirname(htmlReportPath), { recursive: true });
  await writeFile(htmlReportPath, renderRequirementCourtHtml(result));

  return {
    markdown: formatRequirementCourtReportPathForOutput(input.rootDir, markdownReportPath),
    html: formatRequirementCourtReportPathForOutput(input.rootDir, htmlReportPath),
  };
}

function replacePathExtension(path: string, extension: string): string {
  const currentExtension = extname(path);
  if (!currentExtension) {
    return `${path}${extension}`;
  }

  return `${path.slice(0, -currentExtension.length)}${extension}`;
}
```

Update `RequirementCourtOutputOptions`:

```ts
interface RequirementCourtOutputOptions {
  discussionHeading?: string | undefined;
  printVisibleThinking?: boolean | undefined;
  markdownReportPath?: string | undefined;
  htmlReportPath?: string | undefined;
}
```

Update `printRequirementCourtResult`:

```ts
function printRequirementCourtResult(
  result: RequirementCourtResult,
  options: RequirementCourtOutputOptions = {},
): void {
  for (const line of renderRequirementCourtTextReport(result, {
    discussionHeading: options.discussionHeading,
    includeVisibleThinking: options.printVisibleThinking,
    markdownReportPath: options.markdownReportPath,
    htmlReportPath: options.htmlReportPath,
    style: { heading: pc.cyan },
  })) {
    console.log(line);
  }
}
```

- [ ] **Step 5: Run the focused CLI tests**

Run:

```bash
rtk bun test tests/cli.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the report-focused tests**

Run:

```bash
rtk bun test tests/html-report.test.ts tests/requirement-report.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
rtk git add src/cli.ts tests/cli.test.ts
rtk git commit -m "feat: write html approval reports from cli"
```

---

### Task 4: Full Verification And Smoke Check

**Files:**
- No source files should change in this task unless verification exposes a defect.

- [ ] **Step 1: Run the full repository gate**

Run:

```bash
rtk bun run check
```

Expected: PASS, including Biome, TypeScript, Bun tests, and 90% line coverage.

- [ ] **Step 2: Run a scratch CLI smoke check**

Run:

```bash
rtk bun run dev -- onboard --dir work/smoke-html-approval --name "HTML Approval Smoke"
rtk bun run dev -- ponyrace --manifest work/smoke-html-approval/.ponyrace/manifest.json --no-research --markdown work/smoke-html-approval/outputs/approval.md "Add CSV import to admin dashboard"
rtk ls work/smoke-html-approval/outputs
rtk sed -n '1,40p' work/smoke-html-approval/outputs/approval.html
```

Expected:

```text
approval.html
approval.md
```

The `sed` output should include:

```html
<!doctype html>
<html lang="en">
```

It should also include a `<title>` containing:

```text
Approve: Add CSV import to admin dashboard
```

- [ ] **Step 3: Manually inspect the HTML artifact**

Open this file in a browser:

```text
/Users/roy/Desktop/SourceCode/ponytrails/work/smoke-html-approval/outputs/approval.html
```

Expected visual result:

- A quiet approval packet, not a marketing page.
- First viewport shows the title, intent, confirmation state, and approval readiness.
- Sections appear in this order: approval question, changes, evidence, risks/open questions, bot review, next steps.
- Text does not overlap at desktop or mobile browser widths.
- No network calls are required.

- [ ] **Step 4: Confirm no unwanted generated files are staged**

Run:

```bash
rtk git status --short --untracked-files=all
```

Expected:

```text
```

or only ignored/generated scratch files under `work/` and `.ponyrace/`.

- [ ] **Step 5: Commit verification-only fixes if needed**

If Task 4 reveals a small source or test fix, make the fix, rerun the relevant focused test, rerun `rtk bun run check`, then commit:

```bash
rtk git add src/runtimes/ponytrail/html-report.ts src/runtimes/ponytrail/requirement-report.ts src/runtimes/ponytrail/index.ts src/cli.ts tests/html-report.test.ts tests/requirement-report.test.ts tests/cli.test.ts
rtk git commit -m "fix: verify html approval report"
```

If no fix is needed, do not create a verification-only commit.

---

## Implementation Notes

- No new CLI flag is needed for the first version.
- HTML generation follows the existing Markdown report behavior.
- `--skip-markdown` should skip both Markdown and HTML because the current CLI has one report-generation switch.
- `--json` should continue to skip report writing.
- A custom `--markdown outputs/ponyrace-report.md` should write the HTML sibling to `outputs/ponyrace-report.html`.
- The HTML renderer must escape every user- and model-provided string before insertion.
- Keep Markdown as the durable text artifact. Treat HTML as the human approval review surface.

## Self-Review

- Spec coverage: The plan covers the renderer, artifact location, page sections, CLI output, escaping, no dependency additions, and verification.
- Placeholder scan: This plan has no placeholders or deferred implementation steps.
- Type consistency: The plan uses existing `RequirementCourtResult`, `RequirementCourtRound`, `RequirementDiscussionEntry`, and report helper names consistently.
