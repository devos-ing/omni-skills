# GetSuperpower Authoring Guideline Spec

## ADDED Requirements

### Requirement: Author Guide Recommends The Authoring Skill

The documentation SHALL tell authors to install and call
`$creating-bundle-skills` when creating a custom GetSuperpower workflow and
skills set.

#### Scenario: new author starts from the guide

- **WHEN** an author reads the GetSuperpower author guide
- **THEN** the guide shows `npx getsuperpower skills install creating-bundle-skills`
- **AND** the guide shows a copyable `$creating-bundle-skills ...` prompt
- **AND** the guide explains what files the skill should help create

### Requirement: Created Workflows Include A Callable Entry Skill

The documentation SHALL explain that a shareable GetSuperpower includes one
entry skill that users call, plus any local or external sub-skills it
orchestrates.

#### Scenario: author designs a workflow skill tree

- **WHEN** an author creates a custom workflow
- **THEN** the guide tells them to keep the entry skill, `workflow.json`, and
  README aligned
- **AND** the guide tells them to validate the workflow before sharing
