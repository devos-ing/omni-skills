# GetSuperpower Landing Workflow Detail Route Spec

## ADDED Requirements

### Requirement: Workflow Cards Navigate To Workflow Detail Pages

The landing page SHALL let visitors navigate from each workflow card to a
dedicated detail page for that workflow.

#### Scenario: visitor opens a workflow detail page

- **WHEN** a visitor activates "View workflow" on a workflow card
- **THEN** the browser navigates to `/workflows/[slug]` for that workflow
- **AND** the detail page identifies the workflow by name
- **AND** the detail view shows the callable entry skill
- **AND** the detail page renders the workflow's ordered steps as a diagram
- **AND** the detail page includes an install command for that workflow
- **AND** the detail page includes a path back to the workflow-card section

#### Scenario: visitor opens the source workflow

- **WHEN** a visitor uses the GitHub source action from the workflow detail page
- **THEN** the link targets the matching workflow folder in
  `https://github.com/0xroylee/getsuperpower`
- **AND** the source action is secondary to the workflow detail explanation

#### Scenario: visitor searches workflow cards

- **WHEN** a visitor filters workflow cards with the search input
- **THEN** each visible card still links to the correct workflow detail route
- **AND** clearing the search lets the visitor navigate to any workflow detail
  route again

#### Scenario: visitor opens an unknown workflow slug

- **WHEN** a visitor navigates to a workflow detail route with an unknown slug
- **THEN** the app renders the Next not-found path
- **AND** it does not render an empty or mismatched workflow detail page

### Requirement: Workflow Detail Pages Use Local Static Data

The landing app SHALL render workflow detail pages from local typed content
instead of runtime CLI state.

#### Scenario: developer inspects landing workflow data

- **WHEN** a developer opens `landing/lib/landing-content.ts`
- **THEN** each workflow card includes enough local metadata to render its
  detail page
- **AND** each workflow card includes a GitHub source URL for its workflow
  bundle
- **AND** each workflow card includes or derives an install command for its
  detail page
- **AND** the landing app does not read generated `.getsuperpower/` workflow
  records to render public workflow details
