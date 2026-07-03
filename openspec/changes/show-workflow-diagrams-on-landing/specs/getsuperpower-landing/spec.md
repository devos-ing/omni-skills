# GetSuperpower Landing Workflow Diagram Spec

## ADDED Requirements

### Requirement: Workflow Cards Show In-Page Workflow Details

The landing page SHALL let visitors inspect each workflow from the workflow-card
section without immediately leaving the page.

#### Scenario: visitor opens a workflow detail

- **WHEN** a visitor activates "View workflow" on a workflow card
- **THEN** the landing page shows an in-page detail view for that workflow
- **AND** the page does not immediately navigate away from the landing page
- **AND** the detail view identifies the workflow by name
- **AND** the detail view shows the callable entry skill
- **AND** the detail view renders the workflow's ordered steps as a diagram

#### Scenario: visitor opens the source workflow

- **WHEN** a visitor uses the GitHub source action from the workflow detail
- **THEN** the link targets the matching workflow folder in
  `https://github.com/0xroylee/getsuperpower`
- **AND** the source action is secondary to the in-page workflow explanation

#### Scenario: visitor searches workflow cards

- **WHEN** a visitor filters workflow cards with the search input
- **THEN** the workflow detail view does not show a selected workflow that is no
  longer visible in the filtered card set
- **AND** clearing the search lets the visitor inspect any workflow card again

### Requirement: Workflow Detail Data Stays Local And Static

The landing app SHALL render workflow details from local typed content instead
of runtime CLI state.

#### Scenario: developer inspects landing workflow data

- **WHEN** a developer opens `landing/lib/landing-content.ts`
- **THEN** each workflow card includes enough local metadata to render its
  in-page detail view
- **AND** each workflow card includes a GitHub source URL for its workflow
  bundle
- **AND** the landing app does not read generated `.getsuperpower/` workflow
  records to render public workflow details
