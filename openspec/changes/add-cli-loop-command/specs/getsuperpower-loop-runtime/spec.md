# GetSuperpower Loop Runtime Spec

## MODIFIED Requirements

### Requirement: Reusable Loop Runtime Entry Point

GetSuperpower SHALL provide a reusable loop runtime entry point for workflows
that declare `loop` in `workflow.json`.

#### Scenario: CLI delegates to shared runtime

- **GIVEN** a workflow bundle declares `loop`
- **WHEN** a user runs
  `getsuperpower loop status <source> --latest --json`
- **THEN** the CLI loads the workflow manifest and delegates command execution
  to the shared loop runtime entry point
- **AND** the reusable runtime handles run lookup, state reading, event
  logging, and output rendering

#### Scenario: workflow wrapper remains compatibility-only

- **GIVEN** a workflow bundle declares a loop script at `./loop.mjs`
- **WHEN** a user runs `node loop.mjs status --latest --json` from the workflow
  or installed entry skill directory
- **THEN** the command remains Node-compatible
- **AND** the wrapper delegates to the shared runtime entry point
- **AND** public docs and agent-facing instructions prefer
  `getsuperpower loop ...`

### Requirement: Existing Loop Commands Stay Compatible

The reusable runtime SHALL preserve loop behavior while allowing callers to
customize the displayed command prefix.

#### Scenario: runtime actions point to CLI commands

- **WHEN** the CLI runs `getsuperpower loop status <source> --latest --json`
- **THEN** returned action commands use `getsuperpower loop ...`
- **AND** they do not instruct the agent to run `node loop.mjs ...`

#### Scenario: direct Node wrapper uses compatibility command text

- **WHEN** the compatibility wrapper runs `node loop.mjs status --latest --json`
- **THEN** returned action commands may use `node loop.mjs ...`
- **AND** runtime behavior remains compatible for installed entry skills that
  call the wrapper directly

### Requirement: Agent-Facing Instructions Use CLI Loop Commands

Looped workflow examples and installed entry-skill guidance SHALL teach agents
to control runs through the GetSuperpower CLI.

#### Scenario: agent reads the grilled product development entry skill

- **WHEN** an agent reads
  `examples/workflows/grilled-product-dev/skills/grilled-product-dev/SKILL.md`
- **THEN** the loop runtime section uses `getsuperpower loop ...` examples
- **AND** it does not require the agent to execute `node loop.mjs ...`
