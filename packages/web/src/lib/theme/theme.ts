import type {
	ResolvedTheme,
	ThemePreference,
	ThemeSnapshot,
} from "@/lib/theme/theme.types";

export const THEME_STORAGE_KEY = "devos-theme-preference";
export const THEME_ATTRIBUTE = "data-theme";
const SYSTEM_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
	return value === "light" || value === "dark" || value === "system";
}

export function getSystemTheme(
	matchMediaFn: ((query: string) => MediaQueryList) | undefined,
): ResolvedTheme {
	if (!matchMediaFn) {
		return "dark";
	}
	return matchMediaFn(SYSTEM_COLOR_SCHEME_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(
	preference: ThemePreference,
	systemTheme: ResolvedTheme,
): ResolvedTheme {
	if (preference === "system") {
		return systemTheme;
	}
	return preference;
}

export function readThemePreference(
	value: string | null,
	fallback: ThemePreference,
): ThemePreference {
	if (!value) {
		return fallback;
	}
	return isThemePreference(value) ? value : fallback;
}

export function readStoredThemePreference(
	storage: Pick<Storage, "getItem"> | undefined,
	fallback: ThemePreference = "system",
): ThemePreference {
	if (!storage) {
		return fallback;
	}
	try {
		return readThemePreference(storage.getItem(THEME_STORAGE_KEY), fallback);
	} catch {
		return fallback;
	}
}

export function writeStoredThemePreference(
	storage: Pick<Storage, "setItem"> | undefined,
	preference: ThemePreference,
): void {
	storage?.setItem(THEME_STORAGE_KEY, preference);
}

export function getThemeSnapshot(options: {
	storedPreference: string | null;
	matchMediaFn: ((query: string) => MediaQueryList) | undefined;
	fallbackPreference?: ThemePreference;
}): ThemeSnapshot {
	const preference = readThemePreference(
		options.storedPreference,
		options.fallbackPreference ?? "system",
	);
	const systemTheme = getSystemTheme(options.matchMediaFn);
	return {
		preference,
		resolvedTheme: resolveTheme(preference, systemTheme),
	};
}

export function applyThemeToDocument(
	documentElement: Pick<HTMLElement, "setAttribute"> | undefined,
	resolvedTheme: ResolvedTheme,
): void {
	documentElement?.setAttribute(THEME_ATTRIBUTE, resolvedTheme);
}

export function getThemeInitScript(): string {
	return `(() => {
		try {
			const key = ${JSON.stringify(THEME_STORAGE_KEY)};
			const attr = ${JSON.stringify(THEME_ATTRIBUTE)};
			const saved = localStorage.getItem(key);
			const valid = saved === "light" || saved === "dark" || saved === "system";
			const preference = valid ? saved : "system";
			const systemDark = window.matchMedia("${SYSTEM_COLOR_SCHEME_QUERY}").matches;
			const resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;
			document.documentElement.setAttribute(attr, resolved);
		} catch {
			document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)}, "dark");
		}
	})();`;
}

export function nextThemePreference(current: ThemePreference): ThemePreference {
	if (current === "light") {
		return "dark";
	}
	if (current === "dark") {
		return "system";
	}
	return "light";
}
