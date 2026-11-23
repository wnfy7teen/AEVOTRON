import { createContext, createElement, useContext, useState } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

const WorkspaceStoreContext = createContext(null);

const createChatSlice = (set) => ({
  messages: [],
  draft: "",
  activeConversationId: "current",
  setMessages: (messages) => set((state) => ({ messages: typeof messages === "function" ? messages(state.messages) : messages })),
  setDraft: (draft) => set((state) => ({ draft: typeof draft === "function" ? draft(state.draft) : draft })),
  setActiveConversationId: (activeConversationId) => set((state) => ({ activeConversationId: typeof activeConversationId === "function" ? activeConversationId(state.activeConversationId) : activeConversationId })),
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
  setModels: (models) => set((state) => ({ models: typeof models === "function" ? models(state.models) : models })),
  setSelectedModelId: (selectedModelId) => set((state) => ({ selectedModelId: typeof selectedModelId === "function" ? selectedModelId(state.selectedModelId) : selectedModelId })),
  setFavoriteModelIds: (favoriteModelIds) => set((state) => ({ favoriteModelIds: typeof favoriteModelIds === "function" ? favoriteModelIds(state.favoriteModelIds) : favoriteModelIds })),
  setRecentModelIds: (recentModelIds) => set((state) => ({ recentModelIds: typeof recentModelIds === "function" ? recentModelIds(state.recentModelIds) : recentModelIds })),
});

const createAttachmentsSlice = (set) => ({
  attachments: [],
  selectedAttachmentIds: [],
  setAttachments: (attachments) => set((state) => ({ attachments: typeof attachments === "function" ? attachments(state.attachments) : attachments })),
  setSelectedAttachmentIds: (selectedAttachmentIds) => set((state) => ({ selectedAttachmentIds: typeof selectedAttachmentIds === "function" ? selectedAttachmentIds(state.selectedAttachmentIds) : selectedAttachmentIds })),
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
  setMetrics: (metrics) => set((state) => ({ metrics: typeof metrics === "function" ? metrics(state.metrics) : metrics })),
  setSessionUsage: (sessionUsage) => set((state) => ({ sessionUsage: typeof sessionUsage === "function" ? sessionUsage(state.sessionUsage) : sessionUsage })),
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
  return createElement(WorkspaceStoreContext.Provider, { value: store }, children);
}

export function useWorkspaceStore(selector) {
  const store = useContext(WorkspaceStoreContext);
  if (!store) throw new Error("useWorkspaceStore must be used inside WorkspaceStoreProvider");
  return useStore(store, selector);
}
