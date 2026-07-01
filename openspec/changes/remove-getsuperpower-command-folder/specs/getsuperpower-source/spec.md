# GetSuperpower Source Ownership Spec

## ADDED Requirements

### Requirement: GetSuperpower Command Module Lives In Main Source

The GetSuperpower command registration module SHALL live inside the main source
tree, not in a separate root package folder.

#### Scenario: source tree is inspected

- **WHEN** maintainers inspect the repository
- **THEN** the command implementation is in `src/getsuperpower.ts`
- **AND** no `getsuperpower-command/` folder exists

### Requirement: Root CLI Behavior Is Preserved

The folder removal SHALL NOT change public command behavior.

#### Scenario: user runs root commands

- **WHEN** a user runs `getsuperpower install`, `getsuperpower clone`, or
  `getsuperpower deps`
- **THEN** the same command behavior remains available

#### Scenario: existing compatibility path is used

- **WHEN** an existing script runs `getsuperpower getsuperpower deps product-dev`
- **THEN** the nested compatibility alias remains available
