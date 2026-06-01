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

		expect(
			new Set(recipes.map((recipe) => JSON.stringify(recipe))).size,
		).toBeGreaterThan(1);
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
		expect(normalizePixelRobotAvatarSize(128)).toBe(
			MAX_PIXEL_ROBOT_AVATAR_SIZE,
		);
		expect(normalizePixelRobotAvatarSize(39.6)).toBe(40);
	});
});
