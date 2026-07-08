# GetSuperpower README Specification

## ADDED Requirements

### Requirement: README Leads With Startup Superpower Positioning

The README SHALL lead with the current GetSuperpower product promise.

#### Scenario: reader opens the README

- **WHEN** a reader opens `README.md`
- **THEN** the first screen presents GetSuperpower with the headline
  "Power your ability."
- **AND** it describes GetSuperpower as an installable workflow skill tree
- **AND** it explains that one callable entry skill coordinates many role and
  process skills
- **AND** it avoids making the reader understand old architecture diagrams
  before seeing the product promise

### Requirement: README Shows Startup Role Workflow Catalog

The README SHALL explain the current startup role catalog.

#### Scenario: reader scans the quick start

- **WHEN** a reader scans the quick start section
- **THEN** the README shows `npx getsuperpower@latest install startup-team`
- **AND** it explains that the startup team bundle includes CEO, CTO, Product
  Manager, Engineering Manager, Founding Engineer, and QA Lead workflows
- **AND** it shows the individual role aliases
- **AND** it keeps commands copyable and root-first

### Requirement: README Explains Goal Loops

The README SHALL explain loop-enabled workflows without implying autonomous tool
execution by the browser or README.

#### Scenario: reader reads goal loop content

- **WHEN** a reader reads the goal loop section
- **THEN** the README describes loops as resumable, action-only workflow state
- **AND** it includes the current `getsuperpower loop` command surface
- **AND** it says a workflow can keep advancing toward a goal until done
- **AND** it does not imply uncontrolled shell/tool execution

### Requirement: README Names The Built-In Skill Ecosystem

The README SHALL name the skill sources that make bundled workflows useful.

#### Scenario: reader reads built-in workflow copy

- **WHEN** a reader reads the ecosystem section
- **THEN** the README mentions Matt Pocock skills
- **AND** it mentions Superpowers skills
- **AND** it mentions Ponytrail evidence
- **AND** it says more workflow packs are coming

### Requirement: README Uses Current Product Image

The README SHALL use current visual material instead of old generic diagrams.

#### Scenario: reader views README visuals

- **WHEN** a reader views the README
- **THEN** it references a repo-local asset based on the provided startup role
  registry screenshot
- **AND** it does not embed `assets/diagrams/getsuperpower-how-it-works.svg`
- **AND** it does not embed `assets/diagrams/getsuperpower-install-sequence.svg`
- **AND** the image alt text describes the startup role workflow registry
