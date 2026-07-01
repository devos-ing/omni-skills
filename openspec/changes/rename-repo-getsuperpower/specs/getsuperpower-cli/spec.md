# GetSuperpower CLI Rename Spec

## ADDED Requirements

### Requirement: Package And Binary Are GetSuperpower

The npm package metadata SHALL present `getsuperpower` as the package and
primary binary name.

#### Scenario: package metadata is inspected

- **WHEN** package metadata is read
- **THEN** the package name is `getsuperpower`
- **AND** the `getsuperpower` binary points at the built CLI
- **AND** the legacy `ponyrace` binary may remain as a transition alias

### Requirement: GetSuperpower Commands Are Root Commands

The CLI SHALL expose GetSuperpower workflow commands directly at the root level.

#### Scenario: user installs a workflow

- **WHEN** a user runs `getsuperpower install product-dev`
- **THEN** the CLI installs the same workflow and skill dependencies as the
  previous nested command

#### Scenario: user clones a workflow

- **WHEN** a user runs `getsuperpower clone product-dev`
- **THEN** the CLI records the installed workflow and installs required skills

### Requirement: Compatibility Aliases Remain Available

The CLI SHALL keep existing compatibility command paths during the rename.

#### Scenario: existing script uses nested command

- **WHEN** a script runs `getsuperpower getsuperpower install product-dev`
- **THEN** the command remains available as a compatibility alias

#### Scenario: existing script uses bundle or workflow aliases

- **WHEN** a script runs `bundle init` or `workflow install`
- **THEN** the command remains available as a compatibility alias
