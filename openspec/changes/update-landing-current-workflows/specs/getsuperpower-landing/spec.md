# GetSuperpower Landing Current Workflow Content Spec

## ADDED Requirements

### Requirement: Landing Page Uses Current CLI Install Language

The landing page SHALL teach the current root-first GetSuperpower install flow.

#### Scenario: visitor reads install commands

- **WHEN** a visitor opens the landing page install section
- **THEN** the page shows alias-first install commands for checked-in example
  workflows
- **AND** the page still presents `npx getsuperpower@latest` as the public
  launcher
- **AND** the page includes commands for listing, authoring, validating,
  inspecting workflow dependencies, locking skill fingerprints, removing
  installed workflows, and checking loop status
- **AND** the page does not show removed nested `getsuperpower` subcommands

#### Scenario: visitor reads install behavior

- **WHEN** a visitor reads the install explanation
- **THEN** the page explains that installs validate workflow manifests
- **AND** it explains that missing external skills can be bootstrapped through
  workflow skill metadata
- **AND** it explains that installed workflow records live under
  `~/.getsuperpower/workflows/` by default
- **AND** it does not describe project-local workflow records as the default

### Requirement: Landing Registry Includes Current Example Workflows

The landing registry SHALL reflect the current checked-in workflow examples.

#### Scenario: visitor browses the current startup role catalog

- **WHEN** a visitor reaches the workflow registry
- **THEN** the registry includes Startup Team
- **AND** the registry includes CEO
- **AND** the registry includes CTO
- **AND** the registry includes Product Manager
- **AND** the registry includes Engineering Manager
- **AND** the registry includes Founding Engineer
- **AND** the registry includes QA Lead
- **AND** each workflow entry shows the callable entry skill
- **AND** each workflow entry links to the workflow detail route

#### Scenario: visitor opens a current workflow detail page

- **WHEN** a visitor opens a workflow detail route
- **THEN** the page shows the workflow install command from local landing
  content
- **AND** the page shows the ordered workflow steps from local landing content
- **AND** the page links to the checked-in workflow source on GitHub

### Requirement: Landing Page Explains Loop-Enabled Workflow Support

The landing page SHALL describe loop-enabled workflows as a current optional
GetSuperpower capability.

#### Scenario: visitor reads loop-enabled workflow content

- **WHEN** a visitor reads a loop-enabled workflow command example
- **THEN** the page explains that loop-enabled workflows use
  `getsuperpower loop` commands for resumable action-only workflow state
- **AND** the page does not imply the browser executes live workflow loops
- **AND** the page does not require generated `.getsuperpower/` runtime state to
  render the landing content

### Requirement: Landing Content Avoids Placeholder Registry Metrics

The landing content SHALL remain grounded in real local workflow data.

#### Scenario: registry telemetry is unavailable

- **WHEN** real workflow registry telemetry is unavailable
- **THEN** the landing page does not show install counts
- **AND** it does not show activity metrics
- **AND** it does not show rank or trending labels
- **AND** it does not fetch live registry telemetry
