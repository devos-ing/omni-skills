# getsuperpower-landing Specification

## Purpose

Define the public GetSuperpower landing page behavior for explaining workflow
bundles, callable entry skills, and local simulated workflow-run demos.

## Requirements
### Requirement: Landing Page Shows A Workflow Run Demo

The landing page SHALL include a deterministic simulated workbench that shows
one startup-goal coordinator dispatching a parallel set of role agents.

#### Scenario: visitor watches the workflow run

- **WHEN** a visitor opens the landing page
- **THEN** the workbench shows selectable real startup cases in its left rail
- **AND** it keeps the Idea to v1, Pivot or focus, and Customer request cases
- **AND** the center chat completes intake, brief approval, and routing before
  showing every selected role agent as started working together
- **AND** role outputs return in deterministic order before a combined answer
- **AND** the right rail shows Intake, Brief approval, Route agents, Collect
  outputs, and Combined answer as read-only queued, active, or complete
  checkpoints
- **AND** the simulated workbench uses restrained neutral role styling with a
  single active accent
- **AND** the section appears before the workflow-card list

#### Scenario: visitor opens a role skill source

- **WHEN** a visitor clicks or keyboard-selects a coordinator or role badge in
  the chat
- **THEN** the badge opens the matching local `SKILL.md` source on GitHub
- **AND** the source link has a descriptive accessible name and safe external
  link attributes
- **AND** no case or checkpoint control duplicates the role agents

#### Scenario: visitor interprets the run demo

- **WHEN** a visitor reads the workflow-run section
- **THEN** the section identifies the displayed run as a simulation
- **AND** it does not imply the browser is executing a live agent workflow
- **AND** it reinforces intake, approval, parallel dispatch, output collection,
  and a combined next action

#### Scenario: visitor uses a narrow or reduced-motion display

- **WHEN** the viewport is below the desktop breakpoint
- **THEN** cases, chat, and checkpoints stack without horizontal scrolling
- **AND WHEN** reduced motion is preferred
- **THEN** the selected case renders directly in its completed state without
  timer-driven typewriter or entry animation

### Requirement: Workflow Run Demo Uses Local Static Content

The landing app SHALL render the workflow-run demo from local typed content.

#### Scenario: developer inspects the workflow-run implementation

- **WHEN** a developer opens the landing source
- **THEN** the workflow-run phases and terminal lines are declared in local
  landing content or a focused local component
- **AND** the demo does not read generated `.getsuperpower/` state
- **AND** the demo does not fetch live workflow status from GitHub, an agent
  runtime, or the CLI
