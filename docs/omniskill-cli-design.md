# Omniskills CLI Design

## Purpose

Omniskills terminal output should feel like a polished developer product:
clear, friendly, compact, and oriented around the next command to run.

Shopify CLI is a useful reference for command-first polish and confident
developer onboarding. Omniskills should not copy Shopify branding, colors, or
wording. Its own style is more agentic: bright brand color, calm structure, and
direct next steps for installing workflow skill trees.

## Design Approaches Considered

### 1. Branded Root Help With Shared Output Helpers

Root help gets the brand moment: ASCII logo, welcome line, examples, and grouped
commands. Subcommands stay compact. Command output reuses shared helper
functions for headings, labels, paths, commands, and next steps.

This is the chosen design. It gives first-run polish without changing command
semantics or turning every command into a banner.

### 2. Banner On Every Command

Every command could start with the ASCII logo and a welcome block. This makes
the CLI memorable, but it would become noisy for repeated commands such as
`deps`, `validate`, and scripts.

### 3. Plain Commander With Colored Status Lines

The CLI could keep default Commander help and only color success output. This is
low risk, but it does not solve the first impression problem or teach the
primary workflow quickly.

## Logo

The root help logo must visibly read `OMNISKILLS`. Keep it ASCII so it
renders reliably in common terminals and CI logs.

Approved logo direction:

```text
   OMNISKILLS
   Skill trees for serious agent work.
```

The implementation may use a wider block logo if it remains readable at narrow
terminal widths. If wrapping becomes awkward, prefer the compact text logo
above.

Use the logo in:

- root `omniskill --help`;
- no-command root invocation if it shows welcome help.

Do not use the logo in:

- successful installs;
- `deps`;
- `validate`;
- scripts or CI-oriented output.

## Palette

Use the existing `picocolors` dependency.

| Role | Color helper | Usage |
| --- | --- | --- |
| Brand | cyan plus bold | Logo, product name, root help headings |
| Success | green plus bold | Completed installs, valid manifests, ready states |
| Warning | yellow | Skipped states and recoverable cautions |
| Error | red | Fatal command failures, when formatted by CLI code |
| Muted | dim | Paths, labels, compatibility notes, secondary detail |
| Command | magenta or bold | Runnable command examples |

Keep color as emphasis, not information. Stripped-ANSI output must still read
clearly.

## Voice

Use short, confident copy.

Prefer:

```text
Welcome to Omniskills.
Install and author workflow skill trees for agent work.
```

Avoid:

```text
This tool provides various utilities that may help users manage workflows.
```

Rules:

- Start with the outcome, then show the command.
- Keep labels one or two words.
- Use "Omniskills" for the product.
- Use "workflow skill tree" when describing what is installed.
- Keep compatibility aliases visibly secondary.

## Root Help Layout

Root help should be structured as:

```text
OMNISKILLS
Welcome to Omniskills.
Install and author workflow skill trees for agent work.

Start:
  omniskill init release-review
  omniskill validate ./release-review
  omniskill install openspec-superpowers
  omniskill install ./release-review

Inspect:
  omniskill list
  omniskill deps ./release-review

Usage:
  omniskill [options] [command]

Commands:
  init
  validate
  install
  list
  deps
  bundle     Compatibility alias
  workflow   Compatibility alias
  skills
```

The exact Commander spacing may differ, but the content order should stay:
brand, welcome, examples, usage, commands, options.

## Command Output Patterns

### Success Heading

```text
Omniskills valid: release-review@0.1.0
Steps: 2
Skills: 4
```

The first line should use the success helper. Labels such as `Steps:` and
`Skills:` should use the muted label helper.

### Install Result

```text
Omniskills install plan: release-review@0.1.0
Workflow records: ~/.omniskills
Skill home: ~/.agents
Skills to install:
- superpowers:brainstorming
- ./skills/release-risk-review
- superpowers:writing-plans
- superpowers:verification-before-completion
? Install 4 skills for release-review? yes
Installing skills...
Processing 1/4: superpowers:brainstorming
Installed skill: superpowers-brainstorming
Omniskills installed: release-review
Omniskills file: ~/.omniskills/workflows/release-review.json
+---------------------------------------------------------------+
| OMNISKILLS                                                    |
| Skill trees for serious agent work.                           |
|                                                               |
| Omniskills installed: release-review                          |
| Version: 0.1.0                                                |
| Skills installed: 4                                           |
| Omniskills file: ~/.omniskills/workflows/release-review.json |
+---------------------------------------------------------------+
```

Install output should list the declared skills before mutating targets, ask for
yes/no approval in interactive terminals, show per-skill processing, and finish
with the bordered OMNISKILLS result panel. In non-interactive shells, continue
without prompting after printing the plan.

### Skill Result

```text
Skill install result
Skill: writing-workflow-skills
Source: /path/to/bundled-skills/writing-workflow-skills
codex: installed /home/.agents/skills/writing-workflow-skills
```

Keep target rows scan-friendly. Do not introduce decorative bullets.

### Empty State

```text
No Omniskills workflows installed.
Next: omniskill install <path-or-git-url>
```

Empty states should include one useful next command when it is safe and obvious.

### Onboard Checklist

```text
Omniskills onboard
Workspace: /path/to/project
RTK ready
CodeGraph ready
Omniskills onboard complete
```

Use the success helper for ready, indexed, guidance, and complete states. Use
the warning helper for skipped states such as `RTK setup skipped` and
`CodeGraph setup skipped`. Use the command helper for runnable setup checks such
as `rtk --version`.

## Implementation Boundaries

- Keep `src/cli.ts` thin. It may configure root help and wire command modules.
- Put reusable terminal formatting in `src/cli-theme.ts`.
- Keep command-specific behavior in `src/omniskill.ts` and existing plugin
  modules.
- Do not add dependencies for this styling pass.
- Do not change command names, aliases, arguments, install behavior, or manifest
  validation behavior.

## Testing

Tests should strip ANSI before asserting content.

Required coverage:

- root help contains `OMNISKILLS`, welcome copy, examples, and current public
  commands;
- no-command invocation prints the welcome help if the implementation enables
  it;
- validate, deps, install, list, onboard, and skill install output retain their
  existing stripped-ANSI facts;
- compatibility aliases remain visible as compatibility aliases.

## Smoke Checks

Before delivery, run:

```bash
rtk bun test tests/cli.test.ts tests/omniskill.test.ts
rtk bun run dev -- --help
rtk bun run dev -- deps examples/workflows/release-review
rtk bun run dev -- validate examples/workflows/release-review
rtk bun run check
```
