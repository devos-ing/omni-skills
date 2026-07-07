# GetSuperpower Workflow Bundle Spec

## MODIFIED Requirements

### Requirement: Looped Workflow Install Prepares Entry Skill Runtime Files

GetSuperpower SHALL prepare looped entry skill installs by copying dynamic
workflow files and generating a small CLI bridge, not by copying generic runtime
code.

#### Scenario: install output contains generated runner and metadata

- **GIVEN** a workflow bundle declares `loop` in `workflow.json`
- **AND** exactly one local skill is marked `entry: true`
- **WHEN** GetSuperpower prepares skill install dependencies
- **THEN** the prepared entry skill includes `SKILL.md`, `workflow.json`,
  generated `loop.mjs`, and generated `loop.metadata.json`
- **AND** the prepared entry skill does not include `loop-runtime.mjs`
- **AND** dependency skills do not receive loop runtime files

#### Scenario: loop script path is generated output

- **GIVEN** a workflow bundle declares `"loop": { "script": "./loop.mjs" }`
- **WHEN** the workflow is validated
- **THEN** GetSuperpower validates that the script path is a relative in-bundle
  `.mjs` output path
- **AND** validation does not require an author-provided `loop.mjs` source file

#### Scenario: metadata stores only dynamic loop discovery data

- **WHEN** GetSuperpower writes `loop.metadata.json`
- **THEN** the metadata records workflow name, entry skill source, generated
  loop script path, state mode, execution mode, and supported commands
- **AND** it does not duplicate generic runtime implementation code

