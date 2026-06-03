import { describe, expect, it } from "bun:test";

type UiStoreModule = typeof import("../src/lib/ui-store/ui-store");

describe("chat room sidebar view storage", () => {
	it("restores a persisted settings sidebar view", async () => {
		const useUiStore = await loadUiStoreWithStorage(
			createMemoryStorage([
				[
					"devos.chatRoom.sidebarView",
					JSON.stringify({
						state: { chatRoomSidebarView: "settings" },
						version: 0,
					}),
				],
			]),
		);

		expect(useUiStore.getState().chatRoomSidebarView).toBe("settings");
	});

	it("falls back to the main sidebar view for invalid persisted values", async () => {
		const useUiStore = await loadUiStoreWithStorage(
			createMemoryStorage([
				[
					"devos.chatRoom.sidebarView",
					JSON.stringify({
						state: { chatRoomSidebarView: "other" },
						version: 0,
					}),
				],
			]),
		);

		expect(useUiStore.getState().chatRoomSidebarView).toBe("main");
	});

	it("persists the selected sidebar view", async () => {
		const storage = createMemoryStorage();
		const useUiStore = await loadUiStoreWithStorage(storage);

		useUiStore.getState().setChatRoomSidebarView("settings");

		expect(storage.getItem("devos.chatRoom.sidebarView")).toBe(
			JSON.stringify({
				state: { chatRoomSidebarView: "settings" },
				version: 0,
			}),
		);
	});
});

async function loadUiStoreWithStorage(
	storage: Storage,
): Promise<UiStoreModule["useUiStore"]> {
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: storage,
	});
	const module = (await import(
		`../src/lib/ui-store/ui-store.ts?test=${Date.now()}-${Math.random()}`
	)) as UiStoreModule;
	return module.useUiStore;
}

function createMemoryStorage(entries: [string, string][] = []): Storage {
	const values = new Map(entries);
	return {
		clear: () => {
			values.clear();
		},
		key: (index) => [...values.keys()][index] ?? null,
		get length() {
			return values.size;
		},
		getItem: (key) => values.get(key) ?? null,
		removeItem: (key) => {
			values.delete(key);
		},
		setItem: (key, value) => {
			values.set(key, value);
		},
	};
}
