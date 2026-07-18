# Omniskills Landing Design

This file is the implementation contract for the `landing/` app. The visual
source of truth is the live [AgentKey homepage](https://agentkey.app/), inspected
on 2026-07-16 from its rendered desktop page, public HTML, Geist font stylesheet,
and public `showcase.css` asset.

"Match AgentKey" means visual-system and composition parity while keeping
Omniskills content, identity, routes, commands, illustrations, and product
claims original. Do not copy AgentKey's logo, wording, Product Hunt proof,
customer count, provider catalog, screenshots, or illustrations.

## Product And Audience

Target users:

- Solo founders who need one goal turned into an approved, implemented, and
  verified release.
- Developers who need product, design, architecture, implementation, and QA
  skills coordinated around a concrete change.
- Startup teams that want explicit role ownership, approval gates, handoffs,
  and verification evidence.

Primary job: understand within one screen that Startup Team installs into the
user's agent environment and coordinates the right specialist skills from a
rough goal to a verified result.

Primary action: copy `npx omniskill@latest install startup-team`.

Secondary actions: inspect the Startup Team source, switch the audience demo,
and explore supported teams or skills.

## Reference Evidence

The live reference uses these defining patterns:

- A 72px translucent sticky navigation over a cool `#FAFAFA` canvas.
- Two persistent desktop guide rails 80px from the viewport edges, enclosing a
  1280px content field.
- Centered hero composition with a large custom emblem, 76px display headline,
  short centered supporting copy, pill CTAs, and compact proof beneath.
- A 1200px product showcase directly after the hero: persona pills, a scenario
  list, and a large agent window.
- Supported-agent marks presented as a centered, wrapping logo field, followed
  by one oversized line illustration.
- Dense capability/service groups made from low-profile 72px cards rather than
  large marketing tiles.
- A split "Why" section with sticky navigation on the left and one large
  feature canvas on the right.
- A restrained three-step setup section, line-separated FAQ, and dark closing
  CTA/footer band.
- Geist throughout, thin `#E6E6E6` rules, cool grey metadata, teal emphasis,
  large negative-tracked headings, mostly white surfaces, and modest shadows.

The current Omniskills page is not visually equivalent: its warm-paper palette,
red-orange accent, left-aligned hero, small brand mark, large isolated cards,
and editorial row styling belong to a different design language.

## Non-Negotiable Visual Direction

Use the reference's cool, technical, product-demonstration character.

Do:

- Center the hero and give it a dominant original Omniskills emblem.
- Use white and cool-neutral full-width bands separated by precise rules.
- Put the interactive product demo immediately after the hero.
- Use the teal family for active states, progress, selected borders, and links.
- Use dense logo and capability grids with real visual assets.
- Use one large original technical line illustration as a brand anchor.
- Keep section headings centered unless the reference pattern is explicitly a
  split sticky-left layout.
- Let whitespace frame strong product visuals rather than replace them.

Do not:

- Return to warm paper, orange-red accents, hand-drawn editorial decoration, or
  asymmetrical magazine layouts.
- Use the existing left-aligned four-line hero.
- Turn every content block into a bordered card.
- Show fake users, stars, rankings, activity, install counts, or live execution.
- reproduce AgentKey's emblem, illustrations, copy, or customer evidence.
- Add gradients as page ambience. Gradient/glow is reserved for the original
  Omniskills hero emblem and fine-pointer scenario-card edge feedback.

## Page Architecture

The public page order is fixed:

1. **Sticky navigation** — Omniskills mark, Overview, Showcase, Capabilities,
   Teams & Skills, FAQ, GitHub, and the primary install action.
2. **Centered hero** — original prismatic Omniskills emblem, concise headline,
   two-line explanation, install pill, source action, and supported-environment
   proof without invented numbers.
3. **Audience product showcase** — Solo Founders, Developers, and Startup Teams
   as pill tabs above a split scenario list and simulated agent window.
4. **Supported agents** — Cursor, Codex, Claude, OpenCode, Hermes, OpenClaw, and
   GitHub Copilot with verified logos or clearly styled neutral brand tiles,
   followed by one original workflow line illustration.
5. **Capability registry** — six capability groups/cards in an AgentKey-like
   dense service grid, each with a distinct illustration or icon.
6. **Why Omniskills** — sticky left-side feature selector and one large feature
   canvas showing coordination, approvals, implementation, and verification.
7. **Teams and Skill Hub** — Startup Team leads; Finance and Market remain real
   companions. The workflow/skill catalog adopts the dense provider-grid
   language rather than a separate editorial system.
8. **Three steps** — install the team, invoke `$startup-goal`, approve and ship.
9. **FAQ** — full-width line-separated native disclosures.
10. **Closing CTA and footer** — one continuous dark band.

Common commands and authoring guidance remain available, but they move below
the product story and use the same terminal/capability styling. They must not
interrupt the sequence between hero, showcase, agents, capabilities, and Why.

## Layout System

Desktop foundation:

- Page maximum: `1440px`.
- Desktop section padding: `126px` inline.
- Fixed guide rails: `80px` from each viewport edge with a `1px` neutral rule;
  hide them below tablet width.
- Inner rail maximum: `1280px`.
- Sticky navigation height: `72px`.
- Navigation grid: `minmax(0, 1fr) auto minmax(0, 1fr)` so center links remain
  optically centered while brand and actions balance the sides.
- Major section padding: `80–120px` block depending on hierarchy.
- Section boundary: `1px solid #E6E6E6`.

Key compositions:

- Hero content is centered and limited to approximately `938px`.
- Showcase is `1200px` at full desktop width. Its internal columns are roughly
  `524px / 634px` with a `42px` gap.
- Supported-agent field is centered and capped near `800px`.
- Capability registry uses four equal columns at wide desktop, two at tablet,
  and one at narrow mobile.
- Why uses a `433px / 640px` split with an `80px` gap and sticky left rail.
- Closing CTA is centered inside a dark band, with a maximum `1280px` inner
  panel and `28px` top-level corner radius when visually separated.

## Color Tokens

```css
--canvas: #fafafa;
--surface: #ffffff;
--surface-soft: #f8fafb;
--surface-muted: #f1f2f4;
--ink: #26202f;
--ink-strong: #17141f;
--body: #6b7280;
--muted: #9ca3af;
--rule: #e6e6e6;
--rule-soft: rgba(0, 0, 0, 0.07);
--accent: #207480;
--accent-strong: #1f7380;
--accent-pressed: #1a6370;
--accent-soft: #e9f4f6;
--accent-selected: #eaf6f7;
--accent-progress: #ccebed;
--success: #41cd75;
--dark: #26202f;
--dark-raised: #2c2733;
--on-dark: #ffffff;
--on-dark-muted: rgba(235, 241, 242, 0.55);
```

These tokens replace the current warm paper, orange accent, pastel planning,
and cream-panel palette. Do not keep both systems.

## Typography

Use Geist Sans and Geist Mono from the official Vercel `geist` package. Load
`GeistSans.variable` and `GeistMono.variable` on the root layout so the font
files are self-hosted by Next.js, available to every route, and do not depend
on a runtime Google Fonts request.

- Hero display: `clamp(48px, 5.28vw, 76px)`, weight `600`, line-height `1.05`,
  tracking `-0.03em`, centered, one or two lines at desktop.
- Section heading: `40–42px`, weight `600`, line-height `1.1`, tracking
  `-0.03em`.
- Feature heading: `26–32px`, weight `600`, line-height `1.2`, tracking
  `-0.02em`.
- Hero body: `18px`, line-height `1.65`, tracking `-0.01em`, maximum `760px`.
- Section body: `16–20px`, line-height `1.6–1.7`.
- Card title: `14px`, weight `600`, line-height `18px`.
- Card metadata: `11–14px`, line-height `14–18px`.
- Agent/status text: Geist Mono at `12–14px`; uppercase only for short status
  labels.

Negative tracking is intentional for display and feature headings. It must not
be applied globally or to long body copy.

## Shape, Border, And Depth

- Pills and primary CTAs: `999px` radius.
- Navigation/select pills: `999px` radius.
- Scenario cards: `18px` radius.
- Agent window: `22px` radius with a `1px #E6E6E6` border and a restrained
  `0 18px 42px rgb(38 32 47 / 10%)` shadow.
- Capability/provider cards: `12px` radius, `1px #D8DEE8` border, no default
  shadow.
- Feature canvases: `20px` radius.
- Small buttons and command controls: `8–10px` radius.
- Closing CTA: `28px` radius at desktop and `20px` on mobile.

Avoid heavy drop shadows. Depth comes from scale, white-on-neutral layering,
thin borders, and one carefully placed agent-window shadow.

## Component Direction

### Navigation

- Translucent `#FAFAFA` at approximately 92% opacity with `16px` backdrop blur.
- Brand left, section links centered, GitHub/install actions right.
- Links are `14px/18px`, weight `500`; active/hover use teal.
- Primary action is a teal pill, not an orange square or text-only link.
- Below desktop, collapse links before letting the brand/actions wrap awkwardly.

### Hero

- Replace the small square Zap badge with a large original Omniskills emblem.
- The emblem may use a prismatic/metallic material, but its silhouette must be
  original and recognizable at 32px.
- Use a compact headline such as “Build with a startup team of agents.” The
  approved copy must fit the centered AgentKey geometry; do not preserve the
  current forced four-line break.
- Present the install command as a centered white pill containing command text
  and an integrated teal copy action.
- Keep GitHub/source as a secondary white pill.
- Do not invent social proof. A valid proof line can state that the team
  installs across seven supported agent environments.

### Audience Showcase

- Persona pills sit above the demo; they replace the separate large audience
  section.
- Left column: audience-responsive heading, one-sentence result, and three
  96px scenario cards.
- Right column: a 634px by approximately 620px simulated conversation window
  that borrows the familiar interaction grammar of ChatGPT and Claude without
  copying their branding. It contains a restrained top bar, user message,
  assistant reasoning summary, inline specialist tool calls, approval state,
  verified assistant answer, and inactive composer.
- Active scenario uses teal number/text, a subtle teal border/glow, and a
  connecting line into the agent window.
- The simulation must say “Example run” or “Simulated run” in visible text.
- No live telemetry and no claim that browser-side agents are executing.

### Shopify Rhythm Refinement

Use Shopify Polaris layout and typography principles to keep the marketing
composition disciplined:

- All padding, margin, and gap values derive from a 4px primitive spacing scale.
  Core values are 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, and 104px.
- Use semantic component padding variables instead of one-off values when the
  same surface repeats.
- UI controls, body copy, navigation, chat messages, and card titles never drop
  below 13px. Captions, timestamps, and compact metadata never drop below 12px.
- All UI line heights are multiples of 4px. Align icons and type vertically
  inside controls rather than relying on visual guesswork.
- Headings stay short and use weight plus size for hierarchy; color is never
  the only distinction.
- The ChatGPT/Claude-like demo is original Omniskills UI. It must feel like a
  real conversation flow, but must not copy either product's logo, exact chrome,
  proprietary icons, or wording.

### Supported Agents

- Center the section heading and explanation.
- Use actual 32px marks with 13px semibold labels in a wrapping field.
- The label sits between two short teal rules.
- Replace the current chip row with this open logo field; avoid bordered pills
  around every agent unless a mark requires a neutral tile.
- Follow with one large original line illustration showing a user goal flowing
  through an Omniskills coordinator into multiple agent environments.

### Capabilities

- Heading: “Everything your startup team needs.”
- Six entries: strategy and validation, product requirements, interface design,
  architecture and implementation, QA and release verification, approval gates
  and handoffs.
- Each entry is a 72px dense card with a 34px original icon/illustration, title,
  and one short descriptor.
- Group cards under meaningful headings when useful; do not use six oversized
  equal marketing tiles.
- Desktop: four columns. Tablet: two. Mobile: one.

### Why Omniskills

- Left rail: eyebrow, “Why Omniskills”, one concise explanation, and four
  selectable feature rows.
- Right canvas: one feature at a time, combining an original illustration with
  product evidence.
- Recommended tabs: One coordinated goal, explicit approval gates, specialist
  execution, verified result.
- The left selector is sticky on desktop and becomes a two-column grid above
  the canvas on mobile/tablet.

### Teams And Skill Hub

- Preserve real team/workflow/skill data and canonical links.
- Restyle results as dense capability/provider cards and grouped catalogs.
- Startup Team can receive one larger featured treatment, but it must share the
  cool-neutral palette and radius system.
- Search and Workflows/Skills tabs remain accessible and deterministic.
- Do not show fake popularity or activity fields.

### Steps, FAQ, CTA, Footer

- Three steps use numbered teal circles and original illustrations.
- FAQ uses native `details/summary`, full-width separators, and no enclosing
  cards. The first item may be open by default.
- Closing CTA and footer form one dark `#26202F` band.
- CTA uses the original Omniskills emblem in a teal rounded square, a centered
  two-line headline, short muted copy, and one teal install button.
- Footer uses compact uppercase links, muted metadata, and 32px circular icon
  buttons.

## Responsive Contract

### Wide desktop: 1260px and above

- Full 126px section padding and visible 80px rails.
- Centered single-row navigation.
- 1200px split showcase.
- Four-column capability/catalog grids.
- Sticky Why and setup left rails.

### Tablet: 769–1259px

- Reduce section padding proportionally; keep a maximum content width.
- Navigation may use two rows or collapse center links into a menu.
- Showcase stacks the scenario column above the agent window; never scale the
  entire desktop UI down as a screenshot.
- Capability grids use two columns.
- Why becomes a vertical composition; selectors remain visible above the
  feature canvas.

### Mobile: 320–768px

- `16px` inline padding; hide guide rails.
- Hero headline `clamp(28px, 9vw, 40px)` and natural wrapping.
- All interactive targets are at least `44px` high.
- CTA pills become full width where necessary.
- Persona pills horizontally scroll or wrap without shrinking labels.
- Scenario cards, agent window, grids, teams, and Skill Hub become one column.
- Agent-window content remains readable at native type sizes; simplify its
  internal layout instead of applying a global scale transform.
- Closing CTA uses `20px` radius and `56px 20px` padding.
- No horizontal overflow at 320px.

## Motion Vocabulary And Contract

Use motion to explain the workflow, confirm interaction, or preserve spatial
continuity. Delete motion whose only purpose is decoration.

- **Persona progress fill** — a linear fill inside the active audience pill;
  it communicates the automatic demo interval. Pause on hover/focus and when
  the document is hidden.
- **Text morph / vertical reveal** — the audience name changes within a clipped
  slot. Use translate and opacity, 220–240ms with the shared strong ease-out.
- **Cursor-proximity edge glow** — fine-pointer-only scenario-card feedback.
  Animate pseudo-element opacity, not layout or a parent-level inherited CSS
  variable tree.
- **Typewriter** — one-time simulated prompt entry. Never run on user-entered or
  keyboard-triggered actions.
- **Stagger** — specialist status rows appear 40–60ms apart during the one-time
  explanatory run.
- **Line drawing / progress sweep** — connectors reveal the handoff direction.
- **Crossfade** — Why feature canvases switch with opacity and at most 8px of
  translation. Pointer activation may use 180–220ms ease-out; keyboard
  activation must switch without movement.
- **Press feedback** — buttons use `scale(0.97)` for 100–160ms.
- **Accordion / collapse** — native FAQ disclosure with no animated height.
  Optional icon/color feedback stays below 180ms.

Shared curves:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
```

Rules:

- UI feedback remains below 300ms.
- Marketing/explanatory sequences may run longer, but every individual state
  change must remain responsive.
- Prefer transitions for interruptible state and CSS/WAAPI for predetermined
  transform/opacity motion.
- Do not animate width, height, margin, padding, top, left, or max-height.
- Do not use `transition: all`, `ease-in`, `scale(0)`, ungated hover transforms,
  ambient loops, parallax, or layout thrashing.
- Reduced motion removes typewriter timing, translation, connector travel,
  pulses, progress auto-advance, and stagger. It displays the selected audience
  and completed workflow statically with short color/opacity feedback only.

## Accessibility

- All tabs use proper tablist/tab/tabpanel semantics, roving tabindex, and
  Arrow Left/Right/Home/End navigation.
- The simulated agent window has one concise accessible description; decorative
  status animation is hidden from assistive technology.
- Copy controls expose copied/failed feedback through a polite live region.
- Agent logos have accessible names; repeated decorative marks use empty alt.
- `details/summary` remains usable without JavaScript.
- Focus styles use a visible teal ring with sufficient contrast.
- Respect `prefers-reduced-motion`, `prefers-reduced-transparency`, and
  `prefers-contrast` where the platform exposes them.
- Color is never the only active/completed indicator.

## Implementation Boundaries

- `landing/lib/landing-content.ts` remains the content source of truth.
- `landing/app/page.tsx` remains the server entry and GitHub-star fetch surface.
- `landing/components/landing-page.tsx` owns page composition.
- `landing/components/workflow-run-demo.tsx` owns the deterministic showcase.
- Keep workflow detail routes and canonical source links intact.
- No React Router transplant, chart dependency, live agent execution, remote
  runtime state, or fabricated telemetry.
- Use original Omniskills SVG/HTML illustration assets. Do not download or ship
  AgentKey's logo, screenshots, or line art.

## Parity Acceptance Criteria

The redesign is not complete until all are true:

- At 1440px, the first screen has centered brand art, centered headline, pill
  actions, cool-neutral palette, sticky nav, and visible vertical rails.
- The audience showcase immediately follows the hero and visibly uses the
  persona/scenario/agent-window composition.
- Supported agents appear as a centered open logo field above one large
  original line illustration.
- Capabilities scan as a dense grid, not six large editorial cards.
- Why Omniskills uses a left selector and right feature canvas at desktop.
- The FAQ is line-separated and the CTA/footer are one dark band.
- The page has no warm-paper/orange design tokens outside legacy route-specific
  content awaiting migration.
- Screenshots at 1440, 768, and 320px show no clipping, illegible scaling, or
  horizontal overflow.
- Keyboard, reduced-motion, and no-JavaScript states remain complete.
- Motion review returns **Approve** under the required animation standards.

## Verification

```bash
rtk bun test tests/landing-app.test.ts tests/landing-skill-hub.test.ts
cd landing && rtk bun run typecheck
cd landing && rtk bun run build
rtk bun run check
```

Visual verification must compare current Omniskills screenshots with the live
reference at 1440, 768, and 320px. Automated source tests are necessary but do
not prove visual parity.
