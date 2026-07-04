# GetSuperpower Landing SEO Spec

## ADDED Requirements

### Requirement: Landing Page Provides Search And Social Metadata

The landing application SHALL expose product-focused SEO metadata through the
Next.js app-router metadata surface.

#### Scenario: crawler reads landing metadata

- **WHEN** a crawler reads the landing page metadata
- **THEN** the metadata title identifies GetSuperpower as the product
- **AND** the metadata description explains that GetSuperpower installs
  AI-agent workflows as callable skills
- **AND** the metadata includes a canonical URL for the public landing page
- **AND** the metadata allows indexing and following links

#### Scenario: visitor shares the landing URL

- **WHEN** the landing URL is shared in a client that reads Open Graph or
  Twitter metadata
- **THEN** the preview metadata includes a product-focused title
- **AND** the preview metadata includes a product-focused description
- **AND** the Open Graph metadata identifies the page as a website
- **AND** the Open Graph metadata includes the landing URL, site name, and
  locale

### Requirement: Landing SEO Does Not Change Product Behavior

The landing SEO update SHALL be static metadata only.

#### Scenario: developer inspects the implementation

- **WHEN** a developer opens the landing SEO implementation
- **THEN** the change is contained in the landing app metadata surface and any
  focused metadata test
- **AND** the landing UI layout and workflow content remain unchanged
- **AND** the change does not add analytics, runtime fetches, or root CLI
  package dependencies
