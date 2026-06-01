# Pixel Robot Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable deterministic 90s terminal-style pixel robot avatar component and use it in the Agents table.

**Architecture:** Keep generation logic pure and tested in `pixel-robot-avatar-utils.ts`, keep contracts in `types/`, and keep SVG rendering in `pixel-robot-avatar.tsx`. The Agents table imports the component directly from the file that owns it, preserving the repo rule against pass-through barrels.

**Tech Stack:** Next.js, React 19, TypeScript, SVG, Tailwind utility classes, Bun tests.

---

## File Structure

- Create `packages/web/src/components/pixel-robot-avatar/types/pixel-robot-avatar.types.ts`
  - Owns avatar prop and recipe contracts.
- Create `packages/web/src/components/pixel-robot-avatar/pixel-robot-avatar-utils.ts`
  - Owns deterministic seed normalization, size normalization, and recipe generation.
- Create `packages/web/src/components/pixel-robot-avatar/pixel-robot-avatar.tsx`
  - Owns React SVG rendering only.
- Create `packages/web/tests/pixel-robot-avatar-utils.test.ts`
  - Covers pure generation behavior without React component markup tests.
- Modify `packages/web/src/components/agents/agent-table-row.tsx`
  - Replaces the generic Lucide bot square with `PixelRobotAvatar`.

## Task 1: Pure Avatar Generation

**Files:**
- Create: `packages/web/src/components/pixel-robot-avatar/types/pixel-robot-avatar.types.ts`
- Create: `packages/web/src/components/pixel-robot-avatar/pixel-robot-avatar-utils.ts`
- Test: `packages/web/tests/pixel-robot-avatar-utils.test.ts`

- [ ] **Step 1: Write the failing utility test**

Create `packages/web/tests/pixel-robot-avatar-utils.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import {
	DEFAULT_PIXEL_ROBOT_AVATAR_SIZE,
	MAX_PIXEL_ROBOT_AVATAR_SIZE,
	MIN_PIXEL_ROBOT_AVATAR_SIZE,
	createPixelRobotRecipe,
	normalizePixelRobotAvatarSize,
} from "../src/components/pixel-robot-avatar/pixel-robot-avatar-utils";

describe("pixel robot avatar utilities", () => {
	it("creates stable recipes for the same seed", () => {
		expect(createPixelRobotRecipe("planner-agent")).toEqual(
			createPixelRobotRecipe("planner-agent"),
		);
	});

	it("creates visual variety across different seeds", () => {
		const recipes = [
			createPixelRobotRecipe("planner-agent"),
			createPixelRobotRecipe("review-agent"),
			createPixelRobotRecipe("builder-agent"),
			createPixelRobotRecipe("release-agent"),
		];

		expect(new Set(recipes.map((recipe) => JSON.stringify(recipe))).size).toBeGreaterThan(1);
	});

	it("uses a safe recipe for blank seeds", () => {
		expect(createPixelRobotRecipe("")).toEqual(createPixelRobotRecipe("   "));
		expect(createPixelRobotRecipe("")).toEqual(
			createPixelRobotRecipe("devos-terminal-robot"),
		);
	});

	it("normalizes avatar size into the supported range", () => {
		expect(normalizePixelRobotAvatarSize(undefined)).toBe(
			DEFAULT_PIXEL_ROBOT_AVATAR_SIZE,
		);
		expect(normalizePixelRobotAvatarSize(Number.NaN)).toBe(
			DEFAULT_PIXEL_ROBOT_AVATAR_SIZE,
		);
		expect(normalizePixelRobotAvatarSize(12)).toBe(MIN_PIXEL_ROBOT_AVATAR_SIZE);
		expect(normalizePixelRobotAvatarSize(128)).toBe(MAX_PIXEL_ROBOT_AVATAR_SIZE);
		expect(normalizePixelRobotAvatarSize(39.6)).toBe(40);
	});
});
```

- [ ] **Step 2: Run the utility test to verify it fails**

Run:

```bash
rtk bun test packages/web/tests/pixel-robot-avatar-utils.test.ts
```

Expected: FAIL because `pixel-robot-avatar-utils` does not exist.

- [ ] **Step 3: Add avatar types**

Create `packages/web/src/components/pixel-robot-avatar/types/pixel-robot-avatar.types.ts`:

```ts
export type PixelRobotAvatarStatus = "online" | "offline";

export type PixelRobotAntennaVariant = "dual" | "none" | "single";

export type PixelRobotEyeVariant = "offset" | "square" | "visor";

export type PixelRobotMouthVariant = "dots" | "line" | "speaker";

export type PixelRobotAccentTone = "crt" | "matrix" | "phosphor";

export type PixelRobotPanelVariant = "center" | "left" | "right";

export interface PixelRobotRecipe {
	accentTone: PixelRobotAccentTone;
	antenna: PixelRobotAntennaVariant;
	eyes: PixelRobotEyeVariant;
	mouth: PixelRobotMouthVariant;
	panel: PixelRobotPanelVariant;
}

export interface PixelRobotAvatarProps {
	className?: string;
	label: string;
	seed: string;
	size?: number;
	status?: PixelRobotAvatarStatus;
}
```

- [ ] **Step 4: Add deterministic utility implementation**

Create `packages/web/src/components/pixel-robot-avatar/pixel-robot-avatar-utils.ts`:

```ts
import type {
	PixelRobotAccentTone,
	PixelRobotAntennaVariant,
	PixelRobotEyeVariant,
	PixelRobotMouthVariant,
	PixelRobotPanelVariant,
	PixelRobotRecipe,
} from "./types/pixel-robot-avatar.types";

const DEFAULT_PIXEL_ROBOT_SEED = "devos-terminal-robot";

export const DEFAULT_PIXEL_ROBOT_AVATAR_SIZE = 40;
export const MIN_PIXEL_ROBOT_AVATAR_SIZE = 24;
export const MAX_PIXEL_ROBOT_AVATAR_SIZE = 96;

const ANTENNA_VARIANTS: PixelRobotAntennaVariant[] = [
	"single",
	"dual",
	"none",
];
const EYE_VARIANTS: PixelRobotEyeVariant[] = ["square", "visor", "offset"];
const MOUTH_VARIANTS: PixelRobotMouthVariant[] = ["line", "dots", "speaker"];
const ACCENT_TONES: PixelRobotAccentTone[] = ["crt", "phosphor", "matrix"];
const PANEL_VARIANTS: PixelRobotPanelVariant[] = ["left", "center", "right"];

export function normalizePixelRobotSeed(seed: string): string {
	const normalizedSeed = seed.trim();
	return normalizedSeed.length > 0 ? normalizedSeed : DEFAULT_PIXEL_ROBOT_SEED;
}

export function normalizePixelRobotAvatarSize(size: number | undefined): number {
	if (typeof size !== "number" || !Number.isFinite(size)) {
		return DEFAULT_PIXEL_ROBOT_AVATAR_SIZE;
	}
	return Math.min(
		MAX_PIXEL_ROBOT_AVATAR_SIZE,
		Math.max(MIN_PIXEL_ROBOT_AVATAR_SIZE, Math.round(size)),
	);
}

export function createPixelRobotRecipe(seed: string): PixelRobotRecipe {
	const hash = hashPixelRobotSeed(normalizePixelRobotSeed(seed));
	return {
		accentTone: pickVariant(ACCENT_TONES, hash, 12),
		antenna: pickVariant(ANTENNA_VARIANTS, hash, 0),
		eyes: pickVariant(EYE_VARIANTS, hash, 4),
		mouth: pickVariant(MOUTH_VARIANTS, hash, 8),
		panel: pickVariant(PANEL_VARIANTS, hash, 16),
	};
}

function hashPixelRobotSeed(seed: string): number {
	let hash = 2166136261;
	for (const character of seed) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function pickVariant<T>(variants: T[], hash: number, shift: number): T {
	const index = (hash >>> shift) % variants.length;
	return variants[index] ?? variants[0];
}
```

- [ ] **Step 5: Run the utility test to verify it passes**

Run:

```bash
rtk bun test packages/web/tests/pixel-robot-avatar-utils.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
rtk git add packages/web/src/components/pixel-robot-avatar/types/pixel-robot-avatar.types.ts packages/web/src/components/pixel-robot-avatar/pixel-robot-avatar-utils.ts packages/web/tests/pixel-robot-avatar-utils.test.ts
rtk git commit -m "Add pixel robot avatar generation"
```

Expected: commit succeeds with only Task 1 files staged.

## Task 2: Pixel Robot SVG Component

**Files:**
- Create: `packages/web/src/components/pixel-robot-avatar/pixel-robot-avatar.tsx`
- Modify: `packages/web/src/components/pixel-robot-avatar/types/pixel-robot-avatar.types.ts`

- [ ] **Step 1: Add SVG cell contracts to the type file**

Update `packages/web/src/components/pixel-robot-avatar/types/pixel-robot-avatar.types.ts` so the full file is:

```ts
export type PixelRobotAvatarStatus = "online" | "offline";

export type PixelRobotAntennaVariant = "dual" | "none" | "single";

export type PixelRobotEyeVariant = "offset" | "square" | "visor";

export type PixelRobotMouthVariant = "dots" | "line" | "speaker";

export type PixelRobotAccentTone = "crt" | "matrix" | "phosphor";

export type PixelRobotPanelVariant = "center" | "left" | "right";

export type PixelRobotCellTone =
	| "accent"
	| "body"
	| "bodyLight"
	| "eye"
	| "eyeDark"
	| "muted"
	| "outline";

export interface PixelRobotCell {
	tone: PixelRobotCellTone;
	x: number;
	y: number;
}

export interface PixelRobotRecipe {
	accentTone: PixelRobotAccentTone;
	antenna: PixelRobotAntennaVariant;
	eyes: PixelRobotEyeVariant;
	mouth: PixelRobotMouthVariant;
	panel: PixelRobotPanelVariant;
}

export interface PixelRobotAvatarProps {
	className?: string;
	label: string;
	seed: string;
	size?: number;
	status?: PixelRobotAvatarStatus;
}
```

- [ ] **Step 2: Add the SVG component implementation**

Create `packages/web/src/components/pixel-robot-avatar/pixel-robot-avatar.tsx`:

```tsx
import type { ReactElement } from "react";

import { cn } from "@/lib/utils";

import {
	createPixelRobotRecipe,
	normalizePixelRobotAvatarSize,
} from "./pixel-robot-avatar-utils";
import type {
	PixelRobotAccentTone,
	PixelRobotAvatarProps,
	PixelRobotCell,
	PixelRobotCellTone,
	PixelRobotRecipe,
} from "./types/pixel-robot-avatar.types";

const PIXEL_ROBOT_VIEWBOX_SIZE = 16;

const PALETTES: Record<
	PixelRobotAccentTone,
	Record<PixelRobotCellTone | "backdrop", string>
> = {
	crt: {
		accent: "#bbf7d0",
		backdrop: "#1f1f1d",
		body: "#3f3f46",
		bodyLight: "#71717a",
		eye: "#86efac",
		eyeDark: "#16a34a",
		muted: "#27272a",
		outline: "#18181b",
	},
	matrix: {
		accent: "#a7f3d0",
		backdrop: "#1b201d",
		body: "#3f3f46",
		bodyLight: "#6b7280",
		eye: "#4ade80",
		eyeDark: "#15803d",
		muted: "#27272a",
		outline: "#18181b",
	},
	phosphor: {
		accent: "#d9f99d",
		backdrop: "#202017",
		body: "#44403c",
		bodyLight: "#78716c",
		eye: "#bef264",
		eyeDark: "#65a30d",
		muted: "#292524",
		outline: "#1c1917",
	},
};

export function PixelRobotAvatar({
	className,
	label,
	seed,
	size,
	status = "online",
}: PixelRobotAvatarProps): ReactElement {
	const avatarSize = normalizePixelRobotAvatarSize(size);
	const recipe = createPixelRobotRecipe(seed);
	const palette = PALETTES[recipe.accentTone];
	const cells = buildPixelRobotCells(recipe);
	const isOffline = status === "offline";

	return (
		<svg
			aria-label={label}
			className={cn("shrink-0", className)}
			height={avatarSize}
			role="img"
			shapeRendering="crispEdges"
			viewBox={`0 0 ${PIXEL_ROBOT_VIEWBOX_SIZE} ${PIXEL_ROBOT_VIEWBOX_SIZE}`}
			width={avatarSize}
		>
			<title>{label}</title>
			<rect fill={palette.backdrop} height="16" rx="2" width="16" />
			{cells.map((cell, index) => (
				<rect
					fill={palette[cell.tone]}
					height="1"
					key={`${cell.x}-${cell.y}-${cell.tone}-${index}`}
					opacity={isOffline && isLitCell(cell.tone) ? 0.45 : 1}
					width="1"
					x={cell.x}
					y={cell.y}
				/>
			))}
		</svg>
	);
}

function buildPixelRobotCells(recipe: PixelRobotRecipe): PixelRobotCell[] {
	return [
		...antennaCells(recipe),
		...headCells(),
		...eyeCells(recipe),
		...mouthCells(recipe),
		...panelCells(recipe),
		...bodyCells(),
	];
}

function antennaCells(recipe: PixelRobotRecipe): PixelRobotCell[] {
	if (recipe.antenna === "none") {
		return [];
	}
	if (recipe.antenna === "dual") {
		return [
			{ tone: "accent", x: 5, y: 0 },
			{ tone: "muted", x: 5, y: 1 },
			{ tone: "accent", x: 10, y: 0 },
			{ tone: "muted", x: 10, y: 1 },
		];
	}
	return [
		{ tone: "accent", x: 8, y: 0 },
		{ tone: "muted", x: 8, y: 1 },
	];
}

function headCells(): PixelRobotCell[] {
	const cells: PixelRobotCell[] = [];
	for (let x = 4; x <= 11; x += 1) {
		cells.push({ tone: "outline", x, y: 2 });
		cells.push({ tone: "outline", x, y: 9 });
	}
	for (let y = 3; y <= 8; y += 1) {
		cells.push({ tone: "outline", x: 3, y });
		cells.push({ tone: "outline", x: 12, y });
	}
	for (let y = 3; y <= 8; y += 1) {
		for (let x = 4; x <= 11; x += 1) {
			cells.push({ tone: "body", x, y });
		}
	}
	cells.push({ tone: "bodyLight", x: 5, y: 3 });
	cells.push({ tone: "bodyLight", x: 6, y: 3 });
	return cells;
}

function eyeCells(recipe: PixelRobotRecipe): PixelRobotCell[] {
	if (recipe.eyes === "visor") {
		return [
			{ tone: "eye", x: 5, y: 5 },
			{ tone: "eye", x: 6, y: 5 },
			{ tone: "eyeDark", x: 7, y: 5 },
			{ tone: "eyeDark", x: 8, y: 5 },
			{ tone: "eye", x: 9, y: 5 },
			{ tone: "eye", x: 10, y: 5 },
		];
	}
	if (recipe.eyes === "offset") {
		return [
			{ tone: "eye", x: 5, y: 5 },
			{ tone: "eyeDark", x: 6, y: 6 },
			{ tone: "eye", x: 10, y: 5 },
			{ tone: "eyeDark", x: 9, y: 6 },
		];
	}
	return [
		{ tone: "eye", x: 5, y: 5 },
		{ tone: "eyeDark", x: 6, y: 5 },
		{ tone: "eye", x: 9, y: 5 },
		{ tone: "eyeDark", x: 10, y: 5 },
	];
}

function mouthCells(recipe: PixelRobotRecipe): PixelRobotCell[] {
	if (recipe.mouth === "dots") {
		return [
			{ tone: "outline", x: 6, y: 7 },
			{ tone: "outline", x: 9, y: 7 },
		];
	}
	if (recipe.mouth === "speaker") {
		return [
			{ tone: "outline", x: 6, y: 7 },
			{ tone: "muted", x: 7, y: 7 },
			{ tone: "outline", x: 8, y: 7 },
			{ tone: "muted", x: 9, y: 7 },
		];
	}
	return [
		{ tone: "outline", x: 6, y: 7 },
		{ tone: "outline", x: 7, y: 7 },
		{ tone: "outline", x: 8, y: 7 },
		{ tone: "outline", x: 9, y: 7 },
	];
}

function panelCells(recipe: PixelRobotRecipe): PixelRobotCell[] {
	const x = recipe.panel === "left" ? 5 : recipe.panel === "right" ? 10 : 8;
	return [
		{ tone: "accent", x, y: 8 },
		{ tone: "eyeDark", x: x - 1, y: 8 },
	];
}

function bodyCells(): PixelRobotCell[] {
	return [
		{ tone: "muted", x: 6, y: 10 },
		{ tone: "muted", x: 7, y: 10 },
		{ tone: "muted", x: 8, y: 10 },
		{ tone: "muted", x: 9, y: 10 },
		{ tone: "body", x: 5, y: 11 },
		{ tone: "body", x: 6, y: 11 },
		{ tone: "body", x: 7, y: 11 },
		{ tone: "body", x: 8, y: 11 },
		{ tone: "body", x: 9, y: 11 },
		{ tone: "body", x: 10, y: 11 },
		{ tone: "bodyLight", x: 6, y: 12 },
		{ tone: "body", x: 7, y: 12 },
		{ tone: "body", x: 8, y: 12 },
		{ tone: "bodyLight", x: 9, y: 12 },
		{ tone: "muted", x: 3, y: 11 },
		{ tone: "muted", x: 12, y: 11 },
		{ tone: "bodyLight", x: 4, y: 13 },
		{ tone: "bodyLight", x: 11, y: 13 },
	];
}

function isLitCell(tone: PixelRobotCellTone): boolean {
	return tone === "accent" || tone === "eye" || tone === "eyeDark";
}
```

- [ ] **Step 3: Run web typecheck**

Run:

```bash
rtk bun run --filter web typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit Task 2**

Run:

```bash
rtk git add packages/web/src/components/pixel-robot-avatar/types/pixel-robot-avatar.types.ts packages/web/src/components/pixel-robot-avatar/pixel-robot-avatar.tsx
rtk git commit -m "Add pixel robot avatar component"
```

Expected: commit succeeds with only Task 2 files staged.

## Task 3: Agents Table Integration

**Files:**
- Modify: `packages/web/src/components/agents/agent-table-row.tsx`

- [ ] **Step 1: Replace the generic bot icon**

Update `packages/web/src/components/agents/agent-table-row.tsx` so the full file is:

```tsx
import { Cpu, Pencil } from "lucide-react";
import type { ReactElement } from "react";

import { PixelRobotAvatar } from "@/components/pixel-robot-avatar/pixel-robot-avatar";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";

import type { AgentRowViewModel } from "./types/agent-list.types";

export function AgentTableRow({
	onEdit,
	row,
}: {
	onEdit: () => void;
	row: AgentRowViewModel;
}): ReactElement {
	return (
		<tr className="border-b border-border/70 hover:bg-surface-hover/50">
			<td className="px-4 py-4">
				<div className="flex min-w-0 items-center gap-3">
					<PixelRobotAvatar
						className="rounded-md bg-surface-input"
						label={`${row.name} avatar`}
						seed={row.id || row.name}
						size={40}
						status={row.status}
					/>
					<div className="min-w-0">
						<Typography className="truncate text-base text-zinc-100">
							{row.name}
						</Typography>
						<Typography className="truncate italic text-zinc-500">
							{row.description || row.owner}
						</Typography>
					</div>
				</div>
			</td>
			<td className="px-3 py-4">
				<span className="inline-flex items-center gap-2 text-sm text-zinc-300">
					<span className={`h-2.5 w-2.5 rounded-full ${row.statusTone}`} />
					{row.statusLabel}
				</span>
			</td>
			<td className="px-3 py-4 text-sm text-zinc-300">{row.workloadLabel}</td>
			<td className="px-3 py-4">
				<span className="inline-flex min-w-0 items-center gap-2 text-sm text-zinc-300">
					<Cpu className="shrink-0 text-zinc-500" size={16} />
					<span className="truncate">{row.runtimeLabel}</span>
				</span>
			</td>
			<td className="px-3 py-4 text-sm text-zinc-400">
				<span className="block truncate">{row.activityLabel}</span>
			</td>
			<td className="px-3 py-4 text-right text-sm text-zinc-200">
				{row.runCount}
			</td>
			<td className="px-3 py-4">
				<Typography className="truncate text-sm text-zinc-200">
					{row.modelLabel}
				</Typography>
				<Typography className="truncate text-xs text-zinc-500">
					{row.reasoningLabel}
				</Typography>
			</td>
			<td className="px-3 py-4 text-right">
				<Button
					aria-label={`Edit ${row.name} model`}
					onClick={onEdit}
					size="icon"
					title="Edit model"
					type="button"
					variant="ghost"
				>
					<Pencil size={16} />
				</Button>
			</td>
		</tr>
	);
}
```

- [ ] **Step 2: Run focused checks**

Run:

```bash
rtk bun test packages/web/tests/pixel-robot-avatar-utils.test.ts
rtk bun run --filter web typecheck
```

Expected: both commands PASS.

- [ ] **Step 3: Commit Task 3**

Run:

```bash
rtk git add packages/web/src/components/agents/agent-table-row.tsx
rtk git commit -m "Use pixel robot avatars for agents"
```

Expected: commit succeeds with only Task 3 files staged.

## Task 4: Browser Verification And Gates

**Files:**
- No new source files expected.

- [ ] **Step 1: Build the web app**

Run:

```bash
rtk bun run --filter web build
```

Expected: PASS.

- [ ] **Step 2: Start the web app for visual verification**

Run:

```bash
rtk bun run --filter web dev
```

Expected: dev server prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 3: Inspect the Agents page in the browser**

Open the local web app at `/agents`. Confirm the first table column shows
40px square pixel robot SVG avatars, not the previous generic Lucide bot icon.
Check that rows still align and text does not overlap.

- [ ] **Step 4: Run repo quality gates**

Run:

```bash
rtk bun run check
rtk bun run typecheck
rtk bun test
```

Expected: PASS, or document any unrelated existing blocker with exact command
output.

- [ ] **Step 5: Final status check**

Run:

```bash
rtk git status --short --branch
```

Expected: clean branch `codex/pixel-robot-avatar`.
