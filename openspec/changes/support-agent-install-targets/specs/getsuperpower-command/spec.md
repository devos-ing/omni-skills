# GetSuperpower Agent Install Target Spec

## ADDED Requirements

### Requirement: CLI Supports Advertised Agent Targets

The CLI SHALL accept skill install and update targets for Claude, Codex, Cursor,
opencode, and GitHub Copilot.

#### Scenario: user installs a skill for all advertised agents

- **WHEN** a user runs
  `getsuperpower skills install pony-trail --agents claude,codex,cursor,opencode,copilot`
- **THEN** the CLI installs the skill into the supported target locations for
  every requested agent
- **AND** the command prints one target result for each requested agent
- **AND** repeated destination paths are handled without duplicate writes or
  conflicting statuses

#### Scenario: user chooses opencode with the request spelling

- **WHEN** a user runs
  `getsuperpower skills install pony-trail --agents opencodex`
- **THEN** the CLI treats `opencodex` as an alias for the canonical `opencode`
  target
- **AND** the printed target result uses the canonical `opencode` name

#### Scenario: user chooses GitHub Copilot with a long spelling

- **WHEN** a user runs
  `getsuperpower skills install pony-trail --agents github-copilot`
- **THEN** the CLI treats `github-copilot` as an alias for the canonical
  `copilot` target
- **AND** the printed target result uses the canonical `copilot` name

#### Scenario: user updates a skill for all advertised agents

- **WHEN** a user runs
  `getsuperpower skills update pony-trail --agents claude,codex,cursor,opencode,copilot`
- **THEN** the CLI refreshes the skill in the supported target locations for
  every requested agent
- **AND** the command prints one target result for each requested agent
- **AND** repeated destination paths are handled without duplicate writes or
  conflicting statuses

### Requirement: Agent Targets Use Documented Destinations

The CLI SHALL write skills to deterministic, documented destinations for each
supported agent target.

#### Scenario: skill target destinations are created

- **WHEN** a user installs or updates `pony-trail` into an isolated `--home`
- **THEN** `claude` writes `.claude/skills/pony-trail/SKILL.md`
- **AND** `codex` writes `.agents/skills/pony-trail/SKILL.md`
- **AND** `codex` mirrors `.codex/skills/pony-trail/SKILL.md`
- **AND** `cursor` writes `.cursor/rules/pony-trail.mdc`
- **AND** `opencode` writes `.agents/skills/pony-trail/SKILL.md`
- **AND** `copilot` writes `.agents/skills/pony-trail/SKILL.md`

### Requirement: Help Text Teaches Supported Targets

The CLI SHALL expose the supported target list in skill install and skill update
help text.

#### Scenario: user reads skill install help

- **WHEN** a user runs `getsuperpower skills install --help`
- **THEN** the `--agents` option mentions `claude`, `codex`, `cursor`,
  `opencode`, and `copilot`

#### Scenario: user reads skill update help

- **WHEN** a user runs `getsuperpower skills update --help`
- **THEN** the `--agents` option mentions `claude`, `codex`, `cursor`,
  `opencode`, and `copilot`

### Requirement: Unsupported Agent Values Fail Clearly

The CLI SHALL reject unsupported agent target names with a clear error.

#### Scenario: user mistypes an agent target

- **WHEN** a user runs `getsuperpower skills install pony-trail --agents unknown-agent`
- **THEN** the CLI fails before writing skill files
- **AND** the error includes `Unknown skill install agent: unknown-agent`

### Requirement: Scratch Smoke Proves Agent Target Installability

Delivery SHALL include a scratch-home smoke check for all advertised agent
targets.

#### Scenario: smoke install runs without real home state

- **GIVEN** an empty project directory under `work/`
- **AND** an empty workspace-local home directory passed with `--home`
- **WHEN** the user runs a skill install or update with all advertised agent
  targets
- **THEN** the command succeeds
- **AND** `.claude/skills`, `.agents/skills`, `.codex/skills`, and
  `.cursor/rules` contain the expected installed skill artifacts under the
  scratch home
