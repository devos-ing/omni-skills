# GetSuperpower Loop Runtime Spec

## MODIFIED Requirements

### Requirement: Reusable Loop Runtime Entry Point

GetSuperpower SHALL provide the reusable loop runtime from the CLI instead of
copying generic runtime logic into every installed entry skill.

#### Scenario: CLI remains the runtime owner

- **GIVEN** a workflow bundle declares `loop`
- **WHEN** a user runs
  `getsuperpower loop status <source> --latest --json`
- **THEN** the CLI loads the workflow manifest and delegates command execution
  to the shared loop runtime entry point
- **AND** the reusable runtime handles run lookup, state reading, event
  logging, and output rendering
- **AND** no installed workflow copy of `loop-runtime.mjs` is required

#### Scenario: generated runner delegates to CLI

- **GIVEN** a looped workflow entry skill has been installed
- **WHEN** a user runs `node loop.mjs status --latest --json` from that entry
  skill directory
- **THEN** the generated runner invokes
  `getsuperpower loop status ./workflow.json --latest --json`
- **AND** the generic loop behavior still comes from the CLI
- **AND** the generated runner contains only dynamic workflow variables and CLI
  forwarding code

### Requirement: Existing Loop Commands Stay Compatible

The CLI loop command SHALL preserve the existing action-only loop behavior while
removing duplicated installed runtime code.

#### Scenario: runtime actions still point to CLI commands

- **WHEN** the CLI runs `getsuperpower loop status <source> --latest --json`
- **THEN** returned action commands use `getsuperpower loop ...`
- **AND** they do not instruct the agent to run `node loop.mjs ...`

#### Scenario: direct Node runner has a clear missing-CLI failure

- **GIVEN** the generated `loop.mjs` runner cannot find `getsuperpower` on
  `PATH`
- **WHEN** a user runs `node loop.mjs status --latest --json`
- **THEN** the command fails with a clear message that the GetSuperpower CLI is
  required for the compatibility runner

