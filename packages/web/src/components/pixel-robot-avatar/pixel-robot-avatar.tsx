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
