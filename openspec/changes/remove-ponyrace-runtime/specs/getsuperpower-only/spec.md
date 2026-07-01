# GetSuperpower-Only Product Spec

## ADDED Requirements

### Requirement: Public CLI Focuses On GetSuperpower Bundles

The CLI SHALL present GetSuperpower bundle-skill commands as the primary product
surface.

#### Scenario: user inspects top-level commands

- **WHEN** a user runs the CLI help command
- **THEN** the visible primary workflow commands are GetSuperpower and skill
  installation commands
- **AND** no Ponyrace requirement-review command is advertised

#### Scenario: user installs a bundle

- **WHEN** a user runs `getsuperpower install <source>`
- **THEN** the CLI installs the bundle's required skills
- **AND** the CLI records the installed workflow under `.ponyrace/workflows`
- **AND** missing external skill packages can be bootstrapped through the CLI

### Requirement: Bundle Authors Can Create And Validate Workflows

The CLI SHALL support authoring a GetSuperpower with an entry skill and local
sub-skills.

#### Scenario: author scaffolds a workflow

- **WHEN** an author runs `getsuperpower init <name>`
- **THEN** the CLI creates `workflow.json`, `README.md`, and an entry
  `skills/<name>/SKILL.md`
- **AND** validation accepts the generated workflow without manual fixes

### Requirement: Ponyrace Requirement Review Is Removed

The codebase SHALL remove the older Ponyrace requirement-court feature.

#### Scenario: user looks for Ponyrace review flow

- **WHEN** the source, tests, and docs are searched for user-facing Ponyrace
  review commands
- **THEN** `/ponyrace`, `ponyrace`, `stream-goal`, `goal`, `vote`, `bots`,
  `setup`, and `onboard` are absent unless retained only in migration notes
- **AND** no runtime module implements role-pony discussion, approval votes, or
  worker-backed requirement review

### Requirement: Skill Installation Remains Supported

The CLI SHALL continue to install bundled, local, Superpowers, and external
skill dependencies.

#### Scenario: user installs an external Skills CLI package

- **WHEN** a user runs `skills install mattpocock/skills`
- **THEN** the CLI runs the Skills CLI package installer internally
- **AND** the user does not need to run `npx skills@latest add mattpocock/skills`
  directly

### Requirement: Documentation Matches The New Product Center

Docs SHALL explain GetSuperpower bundle skills without presenting Ponyrace
requirement review as a supported product feature.

#### Scenario: new user reads README

- **WHEN** a new user opens the README
- **THEN** the quick start teaches GetSuperpower install, dependency inspection,
  authoring, and skill installation
- **AND** any removed Ponyrace review flow is not part of the main path
