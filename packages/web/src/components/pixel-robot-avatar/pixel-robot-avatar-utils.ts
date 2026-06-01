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

const ANTENNA_VARIANTS: PixelRobotAntennaVariant[] = ["single", "dual", "none"];
const EYE_VARIANTS: PixelRobotEyeVariant[] = ["square", "visor", "offset"];
const MOUTH_VARIANTS: PixelRobotMouthVariant[] = ["line", "dots", "speaker"];
const ACCENT_TONES: PixelRobotAccentTone[] = ["crt", "phosphor", "matrix"];
const PANEL_VARIANTS: PixelRobotPanelVariant[] = ["left", "center", "right"];

export function normalizePixelRobotSeed(seed: string): string {
	const normalizedSeed = seed.trim();
	return normalizedSeed.length > 0 ? normalizedSeed : DEFAULT_PIXEL_ROBOT_SEED;
}

export function normalizePixelRobotAvatarSize(
	size: number | undefined,
): number {
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
