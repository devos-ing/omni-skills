"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
	UiChatRoomSidebarView,
	UiDraftState,
	UiModalState,
	UiStore,
	UiStoreState,
	UiViewFilters,
} from "./types/ui-store.types";

const CHAT_ROOM_SIDEBAR_VIEW_STORAGE_KEY = "devos.chatRoom.sidebarView";

const defaultViewFilters: UiViewFilters = {
	status: "all",
	searchQuery: "",
	assignedAgentId: null,
	sortOrder: "newest",
};

const defaultDrafts: UiDraftState = {
	runNotesDraft: "",
	commandInputDraft: "",
};

const defaultChatRoomSidebarView: UiChatRoomSidebarView = "main";

const defaultModalState: UiModalState = {
	kind: null,
};

const createDefaultState = (): UiStoreState => ({
	selectedWorkspaceId: null,
	viewFilters: defaultViewFilters,
	drafts: defaultDrafts,
	chatRoomSidebarView: defaultChatRoomSidebarView,
	pinnedIssues: [],
	pinnedSessionIds: [],
	modal: defaultModalState,
});

export const useUiStore = create<UiStore>()(
	persist(
		(set) => ({
			...createDefaultState(),
			setSelectedWorkspaceId: (workspaceId) => {
				set({ selectedWorkspaceId: workspaceId });
			},
			updateViewFilters: (partial) => {
				set((state) => ({
					viewFilters: { ...state.viewFilters, ...partial },
				}));
			},
			resetViewFilters: () => {
				set({ viewFilters: defaultViewFilters });
			},
			updateDrafts: (partial) => {
				set((state) => ({ drafts: { ...state.drafts, ...partial } }));
			},
			clearDrafts: () => {
				set({ drafts: defaultDrafts });
			},
			setChatRoomSidebarView: (view) => {
				set({ chatRoomSidebarView: view });
			},
			pinIssue: (issue) => {
				set((state) => ({
					pinnedIssues: [
						issue,
						...state.pinnedIssues.filter((item) => item.id !== issue.id),
					],
				}));
			},
			unpinIssue: (issueId) => {
				set((state) => ({
					pinnedIssues: state.pinnedIssues.filter(
						(item) => item.id !== issueId,
					),
				}));
			},
			pinSession: (sessionId) => {
				set((state) => ({
					pinnedSessionIds: [
						sessionId,
						...state.pinnedSessionIds.filter((item) => item !== sessionId),
					],
				}));
			},
			unpinSession: (sessionId) => {
				set((state) => ({
					pinnedSessionIds: state.pinnedSessionIds.filter(
						(item) => item !== sessionId,
					),
				}));
			},
			openModal: (kind, contextId = null) => {
				set({ modal: { kind, contextId } });
			},
			closeModal: () => {
				set({ modal: defaultModalState });
			},
			resetUiState: () => {
				set(createDefaultState());
			},
		}),
		{
			merge: (persistedState, currentState) => ({
				...currentState,
				chatRoomSidebarView:
					readPersistedChatRoomSidebarView(persistedState) ??
					currentState.chatRoomSidebarView,
			}),
			name: CHAT_ROOM_SIDEBAR_VIEW_STORAGE_KEY,
			partialize: (state) => ({
				chatRoomSidebarView: state.chatRoomSidebarView,
			}),
			storage: createJSONStorage(() => localStorage),
		},
	),
);

function readPersistedChatRoomSidebarView(
	persistedState: unknown,
): UiChatRoomSidebarView | null {
	if (!isObjectRecord(persistedState)) {
		return null;
	}
	const view = persistedState.chatRoomSidebarView;
	return view === "main" || view === "settings" ? view : null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
