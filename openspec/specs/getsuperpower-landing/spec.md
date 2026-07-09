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
- **AND** the section shows selectable real startup cases for `/startup-goal`
  as category controls outside the simulated agent-workbench frame
- **AND** at least one case shows an idea-to-v1 startup prompt
- **AND** at least one case shows a pivot or focus decision prompt
- **AND** at least one case shows a customer-request release prompt
- **AND** the section shows startup-goal, CEO, product manager, CTO,
  engineering manager, founding engineer, and QA lead role calls
- **AND** the section shows visible processing points such as intake,
  approval, routing, handoff, risk, or release gates
- **AND** the simulated workbench uses restrained neutral role styling with a
  single active accent instead of assigning separate colors to every role
- **AND** completed transcript entries summarize returned role responses
  instead of repeating every checklist line
- **AND** the section appears before the workflow-card list

#### Scenario: visitor interprets the run demo

- **WHEN** a visitor reads the workflow-run section
- **THEN** the section indicates that the displayed run is simulated
- **AND** it does not imply the browser is executing a live agent workflow
- **AND** it reinforces that the entry skill records intake, approval,
  routing, role handoffs, and a combined next action

#### Scenario: visitor views a workflow-run skill

- **WHEN** a visitor clicks or keyboard-selects a skill in the run-calls rail
- **THEN** the page visibly selects that skill
- **AND** the page shows the selected skill id, owner or role, current demo
  status, checklist lines, and returned response
- **AND** the page exposes a source link for the local `SKILL.md` without
  implying that the browser is executing that skill

#### Scenario: visitor views a workflow-run skill

- **WHEN** a visitor clicks or keyboard-selects a skill in the run-calls rail
- **THEN** the page visibly selects that skill
- **AND** the page shows the selected skill id, owner or role, current demo
  status, checklist lines, and returned response
- **AND** the page exposes a source link for the local `SKILL.md` without
  implying that the browser is executing that skill

### Requirement: Workflow Run Demo Uses Local Static Content

The landing app SHALL render the workflow-run demo from local typed content.

#### Scenario: developer inspects the workflow-run implementation

- **WHEN** a developer opens the landing source
- **THEN** the workflow-run phases and terminal lines are declared in local
  landing content or a focused local component
- **AND** the demo does not read generated `.getsuperpower/` state
- **AND** the demo does not fetch live workflow status from GitHub, an agent
  runtime, or the CLI
