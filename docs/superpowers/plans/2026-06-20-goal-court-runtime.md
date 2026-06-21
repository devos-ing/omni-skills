# Goal Court Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bun/TypeScript CLI runtime that onboards a project, loads a bot manifest, drafts requirement-first goal contracts, and applies a 3-bot / 2-approval goal direction rule.

**Architecture:** Keep the CLI shell thin and put behavior in focused modules: manifest loading, onboarding file generation, goal contract drafting, and vote tallying. The first runtime slice is deterministic and adapter-neutral; Codex and Claude are represented in manifest config, but no live agent process is launched yet.

**Tech Stack:** Bun, TypeScript, Commander, @clack/prompts, picocolors, Zod, Biome, Husky.

---

## File Structure

- `package.json`: Bun scripts and dependencies.
- `tsconfig.json`: strict TypeScript configuration.
- `biome.json`: formatting and linting rules.
- `.gitignore`: generated/runtime ignores.
- `.husky/pre-commit`: Biome, typecheck, and test gate.
- `src/cli.ts`: Commander command registration.
- `src/index.ts`: public module exports.
- `src/manifest.ts`: Zod manifest schema, default manifest, load/write helpers.
- `src/onboarding.ts`: onboarding file creation.
- `src/goal.ts`: goal contract draft creation.
- `src/voting.ts`: vote tallying and decision-rule enforcement.
- `tests/*.test.ts`: Bun tests for manifest, onboarding, goal, and voting behavior.

## Task 1: Project Scaffold and Failing Tests

- [ ] Create project config files.
- [ ] Create failing tests for manifest validation, onboarding, goal drafting, and voting.
- [ ] Run `bun test` and verify tests fail because production modules do not exist yet.

Expected red output includes missing modules such as:

```text
Cannot find module '../src/manifest'
```

## Task 2: Runtime Modules

- [ ] Implement `src/manifest.ts` with Zod schemas and `createDefaultManifest()`.
- [ ] Implement `src/onboarding.ts` with `createOnboardingFiles()`.
- [ ] Implement `src/goal.ts` with `draftGoalContract()`.
- [ ] Implement `src/voting.ts` with `tallyVotes()`.
- [ ] Run `bun test` and verify module tests pass.

## Task 3: CLI Commands

- [ ] Implement `src/cli.ts` with Commander commands:
  - `onboard`
  - `bots`
  - `goal <request>`
  - `vote`
- [ ] Use @clack/prompts for interactive onboarding.
- [ ] Use picocolors for readable CLI output.
- [ ] Run CLI smoke checks with `bun run dev -- --help` and command examples.

## Task 4: Tooling

- [ ] Add Biome config and scripts.
- [ ] Add Husky pre-commit hook that runs `bun run check`.
- [ ] Run `bun install`, `bun run typecheck`, `bun test`, and `bun run check`.

## Self-Review Notes

- The v1 runtime intentionally does not call live LLM APIs.
- The manifest keeps worker agents adapter-neutral so Codex and Claude can be controlled through CLI adapters later.
- The goal court approval rule is implemented as data, not hard-coded into CLI commands.
