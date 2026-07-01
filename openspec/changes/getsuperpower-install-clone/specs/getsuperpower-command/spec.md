# GetSuperpower Install/Clone Command Spec

## ADDED Requirements

### Requirement: GetSuperpower Clone Installs Bundle Skill Sets

The CLI SHALL expose `getsuperpower clone <source>` as a public command for
deploying a GetSuperpower bundle skills set.

#### Scenario: user clones a bundled workflow by name

- **WHEN** a user runs `getsuperpower clone product-dev`
- **THEN** the CLI installs the same required skills as
  `getsuperpower install product-dev`
- **AND** the CLI records the installed workflow under `.getsuperpower/workflows`
- **AND** the command succeeds without requiring the legacy `workflow` alias

#### Scenario: user clones a local author-created workflow

- **WHEN** a user runs `getsuperpower clone ./my-workflow`
- **THEN** the CLI validates and installs the workflow from that local source
- **AND** local skills referenced by `./skills/<name>` are installed from the
  workflow directory

### Requirement: Install Remains Backwards Compatible

The CLI SHALL keep `getsuperpower install <source>` compatible with existing
users and documentation.

#### Scenario: existing install command still works

- **WHEN** a user runs `getsuperpower install product-dev`
- **THEN** the CLI installs the bundle skills set as before
- **AND** no migration is required for existing scripts

### Requirement: Command Help Teaches Install And Clone

The CLI SHALL make `install` and `clone` visible under the primary
`getsuperpower` command.

#### Scenario: user inspects help

- **WHEN** a user runs `getsuperpower --help`
- **THEN** both `install` and `clone` are listed as GetSuperpower commands
- **AND** the descriptions explain that the source is a bundle skills set name,
  local path, or shareable workflow source

### Requirement: Authors Can Share Deployable Bundle Skill Sets

Docs SHALL explain that any author can create, validate, share, and let others
install or clone a GetSuperpower bundle skills set.

#### Scenario: new author reads the guide

- **WHEN** an author reads the README or workflow author guide
- **THEN** the guide explains the loop:
  `getsuperpower init`, edit skills/workflow, `getsuperpower validate`, share
  the folder or repo, and users run `getsuperpower install` or
  `getsuperpower clone`
