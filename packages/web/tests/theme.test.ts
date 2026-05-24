import { describe, expect, it } from "bun:test";

import {
	THEME_ATTRIBUTE,
	THEME_STORAGE_KEY,
	applyThemeToDocument,
	getSystemTheme,
	getThemeInitScript,
	getThemeSnapshot,
	isThemePreference,
	nextThemePreference,
	readStoredThemePreference,
	readThemePreference,
	resolveTheme,
	writeStoredThemePreference,
} from "../src/lib/theme/theme";

describe("theme helpers", () => {
	it("validates theme preference values", () => {
		expect(isThemePreference("dark")).toBe(true);
		expect(isThemePreference("light")).toBe(true);
		expect(isThemePreference("system")).toBe(true);
		expect(isThemePreference("sepia")).toBe(false);
	});

	it("resolves system preference correctly", () => {
		expect(resolveTheme("dark", "light")).toBe("dark");
		expect(resolveTheme("light", "dark")).toBe("light");
		expect(resolveTheme("system", "dark")).toBe("dark");
		expect(resolveTheme("system", "light")).toBe("light");
	});

	it("reads stored theme preference with fallback", () => {
		expect(readThemePreference("light", "dark")).toBe("light");
		expect(readThemePreference("dark", "light")).toBe("dark");
		expect(readThemePreference("system", "dark")).toBe("system");
		expect(readThemePreference("invalid", "dark")).toBe("dark");
		expect(readThemePreference(null, "dark")).toBe("dark");
	});

	it("defaults system theme to dark when matchMedia is unavailable", () => {
		expect(getSystemTheme(undefined)).toBe("dark");
	});

	it("reads system theme from matchMedia", () => {
		const darkMatchMedia = (_query: string): MediaQueryList =>
			({ matches: true }) as MediaQueryList;
		const lightMatchMedia = (_query: string): MediaQueryList =>
			({ matches: false }) as MediaQueryList;
		expect(getSystemTheme(darkMatchMedia)).toBe("dark");
		expect(getSystemTheme(lightMatchMedia)).toBe("light");
	});

	it("reads and writes preference with stable storage key", () => {
		let stored: string | null = null;
		const storage = {
			getItem: (_key: string): string | null => stored,
			setItem: (_key: string, value: string): void => {
				stored = value;
			},
		};
		expect(THEME_STORAGE_KEY).toBe("devos-theme-preference");
		expect(readStoredThemePreference(storage)).toBe("system");
		writeStoredThemePreference(storage, "light");
		expect(readStoredThemePreference(storage, "dark")).toBe("light");
	});

	it("falls back when storage read throws", () => {
		const throwingStorage = {
			getItem: (_key: string): string | null => {
				throw new Error("blocked");
			},
		};
		expect(readStoredThemePreference(throwingStorage, "system")).toBe("system");
		expect(readStoredThemePreference(throwingStorage, "dark")).toBe("dark");
	});

	it("builds theme snapshots from storage + system preference", () => {
		const darkMatchMedia = (_query: string): MediaQueryList =>
			({ matches: true }) as MediaQueryList;
		const lightMatchMedia = (_query: string): MediaQueryList =>
			({ matches: false }) as MediaQueryList;
		expect(
			getThemeSnapshot({
				storedPreference: "system",
				matchMediaFn: darkMatchMedia,
			}).resolvedTheme,
		).toBe("dark");
		expect(
			getThemeSnapshot({
				storedPreference: "light",
				matchMediaFn: darkMatchMedia,
			}).resolvedTheme,
		).toBe("light");
		expect(
			getThemeSnapshot({
				storedPreference: "invalid",
				matchMediaFn: lightMatchMedia,
				fallbackPreference: "dark",
			}).preference,
		).toBe("dark");
	});

	it("applies resolved theme attribute to document root", () => {
		let attrValue = "";
		const root = {
			setAttribute: (name: string, value: string): void => {
				expect(name).toBe(THEME_ATTRIBUTE);
				attrValue = value;
			},
		};
		applyThemeToDocument(root, "light");
		expect(attrValue).toBe("light");
	});

	it("returns init script and theme cycle order", () => {
		const script = getThemeInitScript();
		expect(script).toContain(THEME_STORAGE_KEY);
		expect(script).toContain(THEME_ATTRIBUTE);
		expect(nextThemePreference("light")).toBe("dark");
		expect(nextThemePreference("dark")).toBe("system");
		expect(nextThemePreference("system")).toBe("light");
	});
});
