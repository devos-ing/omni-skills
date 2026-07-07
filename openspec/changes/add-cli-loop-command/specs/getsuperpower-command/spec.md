# GetSuperpower Command Spec

## ADDED Requirements

### Requirement: CLI Executes Looped Workflow Runs

The CLI SHALL expose a root `getsuperpower loop` command for controlling
looped workflow runs.

#### Scenario: user starts a loop run through the CLI

- **GIVEN** a workflow source declares `loop` in `workflow.json`
- **WHEN** a user runs
  `getsuperpower loop start <source> --run smoke --json`
- **THEN** the CLI starts run `smoke` for that workflow
- **AND** the JSON response includes the workflow name, run id, status, current
  step, instruction, and action list
- **AND** the user does not need to run `node loop.mjs`

#### Scenario: user reads latest loop status through the CLI

- **GIVEN** a workflow source declares `loop`
- **AND** at least one active run exists for that workflow
- **WHEN** a user runs `getsuperpower loop status <source> --latest --json`
- **THEN** the CLI returns the latest active run status using the same response
  shape as the reusable loop runtime

#### Scenario: user records a structured loop event through the CLI

- **GIVEN** a workflow source declares `loop`
- **AND** run `smoke` exists
- **WHEN** a user runs
  `getsuperpower loop log <source> --run smoke --type phase_result --message "done" --metadata '{"ok":true}' --json`
- **THEN** the CLI appends a structured event to that run
- **AND** the response reports the event type, step, message, metadata, and
  next actions

#### Scenario: user advances a loop run through the CLI

- **GIVEN** a workflow source declares `loop`
- **AND** run `smoke` is active
- **WHEN** a user runs `getsuperpower loop advance <source> --run smoke --json`
- **THEN** the CLI advances to the next manifest step or completes the run
- **AND** forced advancement still requires both `--force` and `--reason`

#### Scenario: user writes a loop summary through the CLI

- **GIVEN** a workflow source declares `loop`
- **AND** run `smoke` exists
- **WHEN** a user runs `getsuperpower loop summary <source> --run smoke --json`
- **THEN** the CLI writes or refreshes the mechanical run summary
- **AND** the response includes the summary path and next actions

### Requirement: CLI Loop Uses Existing Workflow Sources

The CLI loop command SHALL resolve workflow sources consistently with existing
GetSuperpower commands where practical.

#### Scenario: user targets a local workflow directory

- **WHEN** a user runs
  `getsuperpower loop start examples/workflows/grilled-product-dev --json`
- **THEN** the CLI loads
  `examples/workflows/grilled-product-dev/workflow.json`
- **AND** loop state is recorded under the configured home directory for the
  workflow name

#### Scenario: user targets a non-loop workflow

- **GIVEN** a workflow source does not declare `loop`
- **WHEN** a user runs `getsuperpower loop start <source> --json`
- **THEN** the CLI fails with a clear message that the workflow is not looped

### Requirement: CLI Help Teaches Loop Subcommands

The CLI SHALL document loop execution as part of the primary GetSuperpower
command surface.

#### Scenario: user inspects root help

- **WHEN** a user runs `getsuperpower --help`
- **THEN** `loop` is listed as a root command
- **AND** its description says it controls looped workflow runs

#### Scenario: user inspects loop help

- **WHEN** a user runs `getsuperpower loop --help`
- **THEN** the help lists `start`, `status`, `log`, `advance`, and `summary`
- **AND** each subcommand accepts a workflow source argument
