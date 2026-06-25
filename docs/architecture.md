# Ponytrail Runtime Architecture

The project is split into one thin CLI shell and three long-lived seams:

```text
src/
  cli.ts
  runtimes/
    ponytrail/
      manifest.ts
      onboarding.ts
      goal.ts
      requirement-court.ts
      snapshots.ts
      voting.ts
  plugins/
    adapters/
      codex-cli/
      claude-cli/
      github-copilot-cli/
    stream-runner.ts
    types.ts
  skills/
    types.ts
```

## Runtime

`src/runtimes/ponytrail` is the first runtime module. It owns the requirement-first court lifecycle:

- load and validate the manifest
- create project onboarding files
- run the requirements brainstorm gate
- draft a goal contract from a raw request
- run each requirement-court pony through a `RequirementPonyRunner`
- tally the requirement court with the manifest decision rule plus a non-voting Judge
- read Pony Trail snapshot history and plan file-level reverts
- print visible role-bot discussion before worker execution is allowed

Snapshot entries may also include opt-in `instruction_context` metadata. This metadata belongs to the snapshot system, not a separate audit log: it stores hashes and statuses for allowlisted instruction files plus compact git/session context so history can explain rule changes without recording prompts or file contents.

The CLI should call this runtime through its exported interface instead of knowing the internals of goal drafting or vote tallying.

## Models

`manifest.models` declares named AI model configurations for the court. Each bot references one of those model IDs through `bot.model`, and manifest validation rejects any bot that points at a missing model.

The runtime treats `provider` and `name` as configuration values. This keeps goal discussion model selection editable in `.ponyrace/manifest.json` without coupling the core runtime to a specific vendor SDK or CLI flag shape.

`requirement-court.ts` exposes a required `RequirementPonyRunner` seam. The core runtime does not choose a fallback runner; the CLI explicitly uses `createLocalRequirementPonyRunner()` for local requirement discussion, while `ponyrace --research` and tests can inject process-backed or model-backed ponies. The researched CLI path expands each pony's manifest skills into the prompt and requires visible evidence before approval. The court invokes the runner for each configured voter in each round until the manifest decision rule approves the direction or the maximum round count is reached.

## Plugins

`src/plugins` is the seam for things that vary by environment or integration:

- worker adapters, such as Codex CLI or Claude CLI
- evidence sources, such as git diffs, test output, screenshots, or CI checks
- review integrations, such as GitHub PR review or local reports

Plugins should satisfy the `RuntimePlugin` interface and be loaded by a runtime, not by the CLI directly.

Worker CLI adapters live under `src/plugins/adapters`:

- `codex-cli` builds non-interactive `codex exec` prompt invocations for Codex CLI.
- `claude-cli` builds `/goal` stdin invocations for Claude CLI.
- `github-copilot-cli` builds `gh copilot suggest` prompt invocations.

Each worker adapter folder uses the same shape:

- `commands.ts` builds the adapter-specific CLI invocation.
- `helpers.ts` exposes run helpers that accept injected process or stream runners.
- `utils.ts` stores adapter-local constants and config.
- `index.ts` exports the public adapter surface.

The adapter modules build invocation descriptions, run them through injected process runners, and stream them through injected stream runners. Worker execution remains behind this seam and is gated by requirement-court approval plus human confirmation. `goal` and default `ponyrace` use the explicit local pony runner for requirement discussion instead of launching a worker. `ponyrace --research` uses the selected worker adapter only to review and vote as each pony; it still does not start implementation. The default Bun-backed stream runner is `src/plugins/adapters/stream-runner.ts`; process spawning must stay behind this seam, not inside `src/cli.ts`.

## Skills

`src/skills` is the seam for reusable judge and drafting capabilities. Default
requirement-court skill definitions live in `src/skills/requirement-court/`
so role-bot review lenses can be edited in one place and then projected into
manifests and researched pony prompts:

- intent alignment
- scope control
- feasibility review
- verification design
- risk review

Skills should describe review behavior and instructions. Bots can compose skills through the manifest without hard-coding those instructions into the runtime.

CLI-backed researched ponies receive the descriptions for their configured manifest skills in the review prompt. This keeps the manifest as the source of truth for role lenses while making the model-backed review explain what evidence it used.

## Project Onboarding Layout

Running onboarding creates a local runtime workspace:

```text
.ponyrace/
  manifest.json
  README.md
  goals/
  runtimes/
  plugins/
  skills/
```

The `.ponyrace` folder is for project-local policy, bot configuration, evidence, and extensions. Source code under `src/` defines the reusable runtime; `.ponyrace/` defines how a specific project uses it.

## Flow

```text
Human request
  -> CLI
  -> ponytrail runtime
  -> requirements brainstorm
  -> ask human for details when unclear
  -> Product Manager, Project Manager, Engineer, and Testing ponies discuss by round
  -> visible round discussion is printed
  -> manifest-defined voting ponies approve the direction
  -> Requirement Judge summarizes and merges one detailed requirement
  -> human confirms the direction
  -> worker adapter execution remains gated
  -> evidence is collected when execution begins
  -> verdict
```
