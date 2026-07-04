# Proposal: Update Landing SEO

## Summary

Improve the isolated Next.js landing app's search and social metadata so the
public GetSuperpower page describes the product clearly when indexed, shared, or
previewed.

## Motivation

The current landing metadata is intentionally minimal: a plain `GetSuperpower`
title, one description, and a GitHub metadata base. That is enough for a browser
tab, but it undersells the page in search results and social previews.

The landing page now presents GetSuperpower as a public workflow-bundle product:
one command installs a complete AI-agent workflow as one callable skill. Its SEO
metadata should carry the same message without implying a hosted registry,
backend service, or live agent runtime.

## Scope

In scope:

- Update the Next.js app-router metadata for the landing app.
- Use a product-focused title and description aligned with the page copy.
- Add canonical URL metadata for the public landing page.
- Add Open Graph and Twitter card metadata for link previews.
- Add robots metadata suitable for a public marketing page.
- Add focused verification that the exported metadata includes the expected SEO
  fields.
- Keep the change inside the isolated `landing/` app unless documentation needs
  a tiny verification note.

Out of scope:

- Changing the landing page layout, visual design, or workflow card content.
- Adding analytics, tracking pixels, schema.org JSON-LD, sitemap generation, or
  hosted deployment configuration.
- Creating a new social preview image unless the owner explicitly asks for one.
- Changing GetSuperpower CLI behavior or root package dependencies.

## Proposed Design Direction

Keep SEO as static Next.js metadata in `landing/app/layout.tsx`. Use the
existing `Metadata` export rather than adding custom `<head>` elements or a new
SEO component.

Recommended metadata shape:

- title: `GetSuperpower - Install AI Agent Workflows as Callable Skills`
- description: a concise explanation that one command installs complete
  AI-agent workflows as callable skills.
- metadata base and canonical URL: the public GetSuperpower URL selected for the
  landing page.
- Open Graph: website type, title, description, URL, site name, and locale.
- Twitter: summary card title and description.
- robots: index and follow.

If the implementation discovers the landing app already has a real deployed
domain or preview image asset, use it. Otherwise, keep the canonical URL aligned
with the existing GitHub/public GetSuperpower URL and ship text-first metadata.

## Acceptance Criteria

- The landing app exports product-focused SEO metadata from its Next.js
  app-router metadata surface.
- Search title and description explain GetSuperpower as a way to install
  AI-agent workflows as callable skills.
- The metadata includes a canonical URL for the public landing page.
- The metadata includes Open Graph fields for title, description, URL, site
  name, type, and locale.
- The metadata includes Twitter card fields for title and description.
- The metadata includes robots settings for a public, indexable page.
- A focused test or check fails before the implementation and passes after the
  metadata is updated.
- `rtk bun run check` passes before delivery.
- If landing-specific verification is available, `rtk bun run check` from
  `landing/` passes before delivery.

## Open Questions For Review

- Should the canonical URL stay on `https://github.com/0xroylee/getsuperpower`
  for now, or is there a deployed landing domain I should use?
- Should this pass stay text-only for social previews, or should we add a
  preview image in a follow-up change?
