# getsuperpower-landing Specification

## Purpose

Define the public GetSuperpower landing page behavior for explaining workflow
bundles, callable entry skills, and local simulated workflow-run demos.

## Requirements
### Requirement: Landing Page Shows A Workflow Run Demo

The landing page SHALL include a section that demonstrates a single callable
workflow skill running its ordered sub-skills.

#### Scenario: visitor watches the workflow run

- **WHEN** a visitor opens the landing page
- **THEN** the page shows a workflow run demo section for an agent workbench
- **AND** the section shows the `/startup-goal` invocation
- **AND** the section shows startup-goal, CEO, product manager, CTO,
  engineering manager, founding engineer, and QA lead role calls
- **AND** the section appears after the "How it works" explanation and before
  the workflow-card list

#### Scenario: visitor interprets the run demo

- **WHEN** a visitor reads the workflow-run section
- **THEN** the section indicates that the displayed run is simulated
- **AND** it does not imply the browser is executing a live agent workflow
- **AND** it reinforces that the entry skill coordinates the sub-skills

### Requirement: Workflow Run Demo Uses Local Static Content

The landing app SHALL render the workflow-run demo from local typed content.

#### Scenario: developer inspects the workflow-run implementation

- **WHEN** a developer opens the landing source
- **THEN** the workflow-run phases and terminal lines are declared in local
  landing content or a focused local component
- **AND** the demo does not read generated `.getsuperpower/` state
- **AND** the demo does not fetch live workflow status from GitHub, an agent
  runtime, or the CLI
