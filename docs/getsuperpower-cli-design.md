# GetSuperpower CLI Design

## Purpose

GetSuperpower terminal output should feel like a polished developer product:
clear, friendly, compact, and oriented around the next command to run.

Shopify CLI is a useful reference for command-first polish and confident
developer onboarding. GetSuperpower should not copy Shopify branding, colors, or
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

The root help logo must visibly read `GETSUPERPOWER`. Keep it ASCII so it
renders reliably in common terminals and CI logs.

Approved logo direction:

```text
   GETSUPERPOWER
   Skill trees for serious agent work.
```

The implementation may use a wider block logo if it remains readable at narrow
terminal widths. If wrapping becomes awkward, prefer the compact text logo
above.

Use the logo in:

- root `getsuperpower --help`;
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
Welcome to GetSuperpower.
Install and author workflow skill trees for agent work.
```

Avoid:

```text
This tool provides various utilities that may help users manage workflows.
```

Rules:

- Start with the outcome, then show the command.
- Keep labels one or two words.
- Use "GetSuperpower" for the product.
- Use "workflow skill tree" when describing what is installed.
- Keep compatibility aliases visibly secondary.

## Root Help Layout

Root help should be structured as:

```text
GETSUPERPOWER
Welcome to GetSuperpower.
Install and author workflow skill trees for agent work.

Start:
  getsuperpower init release-review
  getsuperpower validate ./release-review
  getsuperpower install openspec-superpowers
  getsuperpower install ./release-review

Inspect:
  getsuperpower list
  getsuperpower deps ./release-review

Usage:
  getsuperpower [options] [command]

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
GetSuperpower valid: release-review@0.1.0
Steps: 2
Skills: 4
```

The first line should use the success helper. Labels such as `Steps:` and
`Skills:` should use the muted label helper.

### Install Result

```text
GetSuperpower installed: release-review
GetSuperpower file: /path/to/.getsuperpower/workflows/release-review.json
```

Do not add the ASCII logo here. Installs can be part of scripts and should stay
short.

### Skill Result

```text
Skill install result
Skill: pony-trail
Source: /path/to/bundled-skills/pony-trail
codex: installed /home/.agents/skills/pony-trail
```

Keep target rows scan-friendly. Do not introduce decorative bullets.

### Empty State

```text
No GetSuperpowers installed.
Next: getsuperpower install <path-or-git-url>
```

Empty states should include one useful next command when it is safe and obvious.

### Onboard Checklist

```text
GetSuperpower onboard
Workspace: /path/to/project
RTK ready
CodeGraph ready
GetSuperpower onboard complete
```

Use the success helper for ready, indexed, guidance, and complete states. Use
the warning helper for skipped states such as `RTK setup skipped` and
`CodeGraph setup skipped`. Use the command helper for runnable setup checks such
as `rtk --version`.

## Implementation Boundaries

- Keep `src/cli.ts` thin. It may configure root help and wire command modules.
- Put reusable terminal formatting in `src/cli-theme.ts`.
- Keep command-specific behavior in `src/getsuperpower.ts` and existing plugin
  modules.
- Do not add dependencies for this styling pass.
- Do not change command names, aliases, arguments, install behavior, or manifest
  validation behavior.

## Testing

Tests should strip ANSI before asserting content.

Required coverage:

- root help contains `GETSUPERPOWER`, welcome copy, examples, and current public
  commands;
- removed Pony Trail commands remain absent;
- no-command invocation prints the welcome help if the implementation enables
  it;
- validate, deps, install, list, onboard, and skill install output retain their
  existing stripped-ANSI facts;
- compatibility aliases remain visible as compatibility aliases.

## Smoke Checks

Before delivery, run:

```bash
rtk bun test tests/cli.test.ts tests/getsuperpower.test.ts
rtk bun run dev -- --help
rtk bun run dev -- deps examples/workflows/release-review
rtk bun run dev -- validate examples/workflows/release-review
rtk bun run check
```
