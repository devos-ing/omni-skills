import type { UiStoreState } from "./types/ui-store.types";
import { useUiStore } from "./ui-store";

const selectedWorkspaceId: UiStoreState["selectedWorkspaceId"] =
	useUiStore.getState().selectedWorkspaceId;
const chatRoomSidebarView: UiStoreState["chatRoomSidebarView"] =
	useUiStore.getState().chatRoomSidebarView;

useUiStore.getState().setSelectedWorkspaceId(selectedWorkspaceId);
useUiStore.getState().setChatRoomSidebarView(chatRoomSidebarView);
useUiStore.getState().updateViewFilters({
	status: "running",
	searchQuery: "query",
	sortOrder: "oldest",
	assignedAgentId: "agent-1",
});
useUiStore.getState().updateDrafts({
	runNotesDraft: "note",
	commandInputDraft: "bun test",
});
useUiStore.getState().openModal("createRun", "workspace-1");
useUiStore.getState().closeModal();
useUiStore.getState().resetViewFilters();
useUiStore.getState().clearDrafts();
useUiStore.getState().resetUiState();
