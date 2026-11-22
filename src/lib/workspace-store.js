import { createContext, useContext, useState } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

const WorkspaceStoreContext = createContext(null);

const createChatSlice = (set) => ({
  messages: [],
  draft: "",
  activeConversationId: "current",
  setMessages: (messages) => set({ messages }),
  setDraft: (draft) => set({ draft }),
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
  appendMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updater) => set((state) => ({
    messages: state.messages.map((message) => message.id === id
      ? (typeof updater === "function" ? updater(message) : { ...message, ...updater })
      : message),
  })),
  resetChat: () => set({ messages: [], draft: "", activeConversationId: "current" }),
});

const createModelsSlice = (set) => ({
  models: [],
  selectedModelId: "",
  favoriteModelIds: [],
  recentModelIds: [],
  setModels: (models) => set({ models }),
  setSelectedModelId: (selectedModelId) => set({ selectedModelId }),
  setFavoriteModelIds: (favoriteModelIds) => set({ favoriteModelIds }),
  setRecentModelIds: (recentModelIds) => set({ recentModelIds }),
});

const createAttachmentsSlice = (set) => ({
  attachments: [],
  selectedAttachmentIds: [],
  setAttachments: (attachments) => set({ attachments }),
  setSelectedAttachmentIds: (selectedAttachmentIds) => set({ selectedAttachmentIds }),
  addAttachments: (items) => set((state) => ({ attachments: [...state.attachments, ...items] })),
  removeAttachment: (id) => set((state) => ({
    attachments: state.attachments.filter((item) => item.id !== id),
    selectedAttachmentIds: state.selectedAttachmentIds.filter((item) => item !== id),
  })),
  clearAttachments: () => set({ attachments: [], selectedAttachmentIds: [] }),
});

const createUsageSlice = (set) => ({
  metrics: null,
  sessionUsage: null,
  setMetrics: (metrics) => set({ metrics }),
  setSessionUsage: (sessionUsage) => set({ sessionUsage }),
});

const createUiSlice = (set) => ({
  isStreaming: false,
  isModelPickerOpen: false,
  isDraggingFiles: false,
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setModelPickerOpen: (isModelPickerOpen) => set({ isModelPickerOpen }),
  setDraggingFiles: (isDraggingFiles) => set({ isDraggingFiles }),
});

export function createWorkspaceStore() {
  return createStore((...args) => ({
    ...createChatSlice(...args),
    ...createModelsSlice(...args),
    ...createAttachmentsSlice(...args),
    ...createUsageSlice(...args),
    ...createUiSlice(...args),
  }));
}

export function WorkspaceStoreProvider({ children }) {
  const [store] = useState(createWorkspaceStore);
  return <WorkspaceStoreContext.Provider value={store}>{children}</WorkspaceStoreContext.Provider>;
}

export function useWorkspaceStore(selector) {
  const store = useContext(WorkspaceStoreContext);
  if (!store) throw new Error("useWorkspaceStore must be used inside WorkspaceStoreProvider");
  return useStore(store, selector);
}
