# GetSuperpower Command Spec

## MODIFIED Requirements

### Requirement: Step-By-Step Onboarding Flow

The CLI SHALL run onboarding as a logo-first, interactive setup checklist.

#### Scenario: user starts onboarding

- **WHEN** a user runs `getsuperpower onboard`
- **THEN** the CLI prints the GetSuperpower logo or banner before prompting
- **AND** shows the target workspace
- **AND** asks one multi-select question for setup choices
- **AND** includes global skills and tools in the selectable choices

#### Scenario: user selects setup choices

- **WHEN** the onboard checklist is displayed
- **THEN** the user can select or unselect choices using the terminal
  multi-select interaction
- **AND** the CLI runs only the setup actions selected by the user
- **AND** the CLI skips unselected setup actions without running their checks or
  install commands

### Requirement: Global Skill Setup

The onboarding flow SHALL include global skill installation choices.

#### Scenario: user selects pony-trail

- **WHEN** the user selects `pony-trail` in the onboard checklist
- **THEN** the CLI installs `pony-trail` through the existing agent skill
  installer seam
- **AND** the CLI prints the normal skill install result
- **AND** tests can inject the install seam without mutating the user's real home
  directory

#### Scenario: user does not select pony-trail

- **WHEN** the user leaves `pony-trail` unselected
- **THEN** the CLI does not call the skill installer for `pony-trail`
- **AND** the CLI continues processing any other selected choices

### Requirement: RTK Setup Check

The onboarding flow SHALL help the user decide whether RTK setup is needed.

#### Scenario: user selects RTK and RTK is already available

- **GIVEN** `rtk --version` succeeds
- **WHEN** the user selects RTK in the onboard checklist
- **THEN** the CLI reports RTK as already ready

#### Scenario: user selects RTK and RTK is missing

- **GIVEN** `rtk --version` fails
- **WHEN** the user selects RTK in the onboard checklist
- **THEN** the CLI prints RTK setup guidance for reduced token usage

#### Scenario: user does not select RTK

- **WHEN** the user leaves RTK unselected
- **THEN** the CLI does not run `rtk --version`
- **AND** does not print RTK setup guidance

### Requirement: CodeGraph Setup Check

The onboarding flow SHALL help the user decide whether CodeGraph indexing is
needed for the current project.

#### Scenario: user selects CodeGraph and CodeGraph is already initialized

- **GIVEN** `.codegraph/` exists in the target project directory
- **WHEN** the user selects CodeGraph in the onboard checklist
- **THEN** the CLI reports CodeGraph as already ready

#### Scenario: user selects CodeGraph and CodeGraph is not initialized

- **GIVEN** `.codegraph/` does not exist in the target project directory
- **WHEN** the user selects CodeGraph in the onboard checklist
- **THEN** the CLI runs `codegraph init -i` in the target project directory
- **AND** reports whether indexing completed successfully

#### Scenario: user does not select CodeGraph

- **WHEN** the user leaves CodeGraph unselected
- **THEN** the CLI does not inspect `.codegraph/`
- **AND** does not run `codegraph init -i`

### Requirement: Onboard Command Is Testable Without Real Setup Side Effects

The onboarding implementation SHALL route selection prompts, skill installs, and
setup commands through injectable seams.

#### Scenario: tests exercise onboarding

- **WHEN** tests run the onboard flow
- **THEN** they can provide selected checklist items without a real terminal
- **AND** they can simulate `pony-trail` skill installation
- **AND** they can simulate `rtk --version`
- **AND** they can simulate `codegraph init -i`
- **AND** they do not invoke the real RTK or CodeGraph binaries
- **AND** they do not mutate the user's real home directory
