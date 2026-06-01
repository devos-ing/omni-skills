# Pixel Robot Avatar Design

## Goal

Add a reusable web component that renders deterministic 90s-style pixel robot
avatars for agents. The first consumer is the Agents table, replacing the
generic bot icon with a stable avatar per agent.

## Scope

- Create a terminal-style pixel robot avatar component for `packages/web`.
- Use the selected visual direction: muted shell-gray body, green CRT eyes, and
  calm operator-console details.
- Generate small deterministic variations from a seed so different agents can
  have different avatars without storing image assets.
- Wire the component into the Agents table.

This does not add avatar uploads, server-side avatar storage, generated bitmap
assets, canvas rendering, or a full avatar editor.

## Architecture

Add a focused component folder under `packages/web/src/components`:

- `pixel-robot-avatar/pixel-robot-avatar.tsx`
  - React component that renders an SVG pixel grid.
  - Accepts layout and accessibility props.
- `pixel-robot-avatar/pixel-robot-avatar-utils.ts`
  - Pure deterministic seed hashing and robot recipe generation.
  - Shared size normalization helper.
- `pixel-robot-avatar/types/pixel-robot-avatar.types.ts`
  - Component props and recipe contracts.

The component will use SVG rectangles instead of image files or canvas. That
keeps the avatar crisp at small sizes, works with the existing React/Tailwind
setup, and lets tests cover generation behavior without markup assertions.

## Component API

`PixelRobotAvatar` props:

- `seed: string`
  - Stable input used to pick deterministic visual details.
- `label: string`
  - Human-readable label for the SVG image.
- `size?: number`
  - Requested square size in pixels.
- `status?: "online" | "offline"`
  - Optional status tone for subtle opacity and base details.
- `className?: string`
  - Extra classes for the outer SVG.

Size is normalized through a pure helper to keep layouts stable. Empty seeds
fall back to a default seed, so consumers do not need special-case handling.

## Visual Generation

The generator maps the seed into a robot recipe:

- antenna variant
- eye variant
- mouth variant
- cheek or panel accent pixels
- terminal-green accent tone

All recipes stay inside the chosen Terminal Robot direction. Variation should
feel like different operators on the same console, not a mix of unrelated
styles.

## Agents Integration

`packages/web/src/components/agents/agent-table-row.tsx` will replace the
current rounded square plus Lucide `Bot` icon with `PixelRobotAvatar`.

The seed should use a stable agent identifier, with a name fallback. The label
should include the agent name so screen readers have useful context.

## Error Handling

- Whitespace-only seeds normalize to a safe default.
- Invalid or missing size values normalize to the default avatar size.
- Extremely small or large sizes are clamped to a sensible range.
- Offline status renders the same robot with a quieter tone rather than a
  different layout.

## Testing

Add a focused Bun test for pure generation behavior:

- the same seed returns the same recipe
- different seeds can produce different recipes
- blank seeds are safe
- size normalization clamps below-minimum, above-maximum, and invalid values

No React component rendering test is needed because the web package explicitly
avoids component markup tests. Visible verification should happen through
typecheck/build and browser inspection after wiring the component into Agents.

## Verification

Focused verification:

- `rtk bun test packages/web/tests/pixel-robot-avatar-utils.test.ts`
- `rtk bun run --filter web typecheck`
- `rtk bun run --filter web build`

Repo gates before final handoff when dependency state allows:

- `rtk bun run check`
- `rtk bun run typecheck`
- `rtk bun test`
