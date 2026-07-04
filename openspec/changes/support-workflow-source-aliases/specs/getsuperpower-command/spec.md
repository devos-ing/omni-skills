## ADDED Requirements

### Requirement: GetSuperpower commands SHALL resolve public workflow aliases

The GetSuperpower workflow source loader SHALL accept a bare workflow alias and
resolve it to the canonical public examples repository path
`https://github.com/0xroylee/getsuperpower.git#examples/workflows/<alias>`.

#### Scenario: user installs the OpenSpec workflow by alias

- **WHEN** the user runs `getsuperpower install openspec-superpowers`
- **THEN** the CLI resolves the source to
  `https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers`
- **AND** installs the workflow using the same behavior as the explicit public
  git URL.

#### Scenario: user inspects an alias before installing

- **WHEN** the user runs `getsuperpower validate openspec-superpowers`
- **THEN** the CLI validates the workflow at
  `examples/workflows/openspec-superpowers` in the canonical public examples
  repository.
- **WHEN** the user runs `getsuperpower deps openspec-superpowers`
- **THEN** the CLI lists that workflow's declared skill dependencies.

#### Scenario: explicit public git source remains supported

- **WHEN** the user runs
  `getsuperpower install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'`
- **THEN** the CLI uses the existing public git source path without treating the
  URL as an alias.

#### Scenario: alias folder name differs from manifest name

- **WHEN** the user runs `getsuperpower install openspec-superpowers`
- **THEN** alias resolution uses the `openspec-superpowers` folder name under
  `examples/workflows`.
- **AND** the installed workflow may still use its manifest `name`, such as
  `openspec-delivery`, for display and workflow record filenames.

#### Scenario: installed alias source records canonical metadata

- **WHEN** an alias install succeeds
- **THEN** the installed workflow record identifies the source as `kind: "git"`.
- **AND** the recorded `url` is the canonical public git URL with the
  `#examples/workflows/<alias>` fragment.
- **AND** a resolved commit is recorded when `git rev-parse HEAD` succeeds.

#### Scenario: requested alias is not found

- **WHEN** the user runs `getsuperpower install missing-workflow`
- **AND** the canonical examples path
  `examples/workflows/missing-workflow` does not contain a `workflow.json`
- **THEN** the CLI fails with a clear error naming `missing-workflow`.
- **AND** the error includes the canonical public examples path that was checked.

#### Scenario: local paths remain explicit

- **WHEN** the user runs `getsuperpower install ./release-review`
- **THEN** the CLI treats the source as a local path.
- **WHEN** the user runs `getsuperpower install release-review/workflow.json`
- **THEN** the CLI treats the source as a local workflow manifest path.
