import { describe, expect, it } from "vitest";
import { createWorkspaceStore } from "../src/lib/workspace-store.js";

describe("Workspace Zustand slices", () => {
  it("keeps chat, models, attachments, usage and UI state isolated per workspace", () => {
    const first = createWorkspaceStore();
    const second = createWorkspaceStore();
    first.getState().setSelectedModelId("groq/model-a");
    first.getState().appendMessage({ id: "m1", role: "user", content: "hello" });
    first.getState().setAttachments([{ id: "f1", name: "notes.txt" }]);
    first.getState().setMetrics({ ttftMs: 120 });
    first.getState().setIsStreaming(true);

    expect(first.getState().selectedModelId).toBe("groq/model-a");
    expect(first.getState().messages).toHaveLength(1);
    expect(first.getState().attachments).toHaveLength(1);
    expect(first.getState().metrics.ttftMs).toBe(120);
    expect(first.getState().isStreaming).toBe(true);
    expect(second.getState().selectedModelId).toBe("");
    expect(second.getState().messages).toHaveLength(0);
    expect(second.getState().attachments).toHaveLength(0);
    expect(second.getState().metrics).toBeNull();
    expect(second.getState().isStreaming).toBe(false);
  });

  it("supports React setState-style functional updates used by the chat screen", () => {
    const store = createWorkspaceStore();
    store.getState().setMessages((messages) => [...messages, { id: "m1" }]);
    store.getState().setMessages((messages) => [...messages, { id: "m2" }]);
    store.getState().setAttachments((files) => [...files, { id: "f1" }]);
    store.getState().setAttachments((files) => [...files, { id: "f2" }]);
    store.getState().setSelectedAttachmentIds((ids) => [...ids, "f1"]);
    store.getState().setSelectedAttachmentIds((ids) => [...ids, "f2"]);
    expect(store.getState().messages.map((item) => item.id)).toEqual(["m1", "m2"]);
    expect(store.getState().attachments.map((item) => item.id)).toEqual(["f1", "f2"]);
    expect(store.getState().selectedAttachmentIds).toEqual(["f1", "f2"]);
  });

  it("removes an attachment from both the file list and selection", () => {
    const store = createWorkspaceStore();
    store.getState().setAttachments([{ id: "f1" }, { id: "f2" }]);
    store.getState().setSelectedAttachmentIds(["f1", "f2"]);
    store.getState().removeAttachment("f1");
    expect(store.getState().attachments.map((file) => file.id)).toEqual(["f2"]);
    expect(store.getState().selectedAttachmentIds).toEqual(["f2"]);
  });
});
