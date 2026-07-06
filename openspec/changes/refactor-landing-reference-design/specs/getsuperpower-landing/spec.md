# GetSuperpower Landing Reference Refactor Spec

## ADDED Requirements

### Requirement: Landing Page Documents Reference-Based Design Direction

The landing app SHALL maintain a local design document that records the active
reference design direction for future landing changes.

#### Scenario: maintainer opens the landing design document

- **WHEN** a maintainer opens `landing/design.md`
- **THEN** the document identifies
  `/Users/roy/Downloads/Create GetSuperpower Workflows/` as the current
  reference source
- **AND** it names the reference files that informed the refactor
- **AND** it documents which reference ideas are adopted
- **AND** it documents which reference ideas are intentionally not copied
- **AND** it points to the landing app files that own content, page
  composition, workflow entries, and verification

### Requirement: Landing Page Shows Workflow Registry Browsing

The landing page SHALL present workflow bundles in a registry-style browsing
surface inspired by the downloaded reference design.

#### Scenario: visitor browses workflows

- **WHEN** a visitor reaches the workflow section
- **THEN** the page shows a compact workflow browsing surface
- **AND** each visible workflow entry identifies the workflow name
- **AND** each visible workflow entry shows the workflow tag
- **AND** each visible workflow entry shows the callable entry skill
- **AND** each visible workflow entry shows local sub-skill count context
- **AND** each visible workflow entry links to that workflow's detail route

#### Scenario: registry metrics are unavailable

- **WHEN** real workflow registry telemetry is unavailable
- **THEN** the workflow section does not show activity metrics
- **AND** the workflow section does not show install counts
- **AND** the workflow section does not show ranking numbers
- **AND** no live registry metrics are fetched

#### Scenario: visitor searches workflow entries

- **WHEN** a visitor filters workflows with the search input
- **THEN** matching workflow entries remain visible
- **AND** nonmatching workflow entries are hidden
- **AND** clearing the search restores the full workflow list
- **AND** visible entries still link to the correct `/workflows/[slug]` route

### Requirement: Landing Reference Refactor Preserves Existing Product Surface

The landing reference refactor SHALL preserve existing product education,
simulation, route, and command behavior while changing the workflow browsing
presentation.

#### Scenario: visitor reads the refactored landing page

- **WHEN** a visitor opens the landing page
- **THEN** the page still presents GetSuperpower as a workflow-bundle product
- **AND** the page still includes supported agent chips
- **AND** the page still includes the GitHub repository star signal
- **AND** the page still includes the "Watch the workflow run" simulation
- **AND** the page still includes root-first command examples
- **AND** workflow detail pages remain available under `/workflows/[slug]`
- **AND** the page does not advertise paused Pony Trail history, revert, or
  prehook features as active public capabilities

#### Scenario: developer inspects implementation dependencies

- **WHEN** a developer inspects the landing refactor
- **THEN** the implementation does not import the reference app's Vite,
  React Router, MUI, broad Radix component stack, or charting dependency stack
- **AND** no charting dependency is added for placeholder workflow telemetry

### Requirement: Workflow Detail Pages Provide Copyable Install Commands

The landing app SHALL make each workflow detail page's install command visible
and copyable.

#### Scenario: visitor copies a workflow install command

- **WHEN** a visitor opens a workflow detail page under `/workflows/[slug]`
- **THEN** the page shows the workflow install command as command-line text
- **AND** the page provides an explicit copy action for that command
- **AND** activating the copy action copies the same command shown on the page
- **AND** the detail page still includes source and back-navigation actions
