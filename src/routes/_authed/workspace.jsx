import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Bot, Check, ChevronDown, CircleStop, Clock3, Command, FileText, MessageSquarePlus, Pencil, Plus, RefreshCw, Search, Sparkles, X, Download, GitBranch, Paperclip, Star } from "lucide-react";
import { api } from "@/api/client";
import { readDemoUser } from "@/lib/AuthContext";
import { ThemeSwitcher } from "@/lib/ThemeSwitcher";

export const Route = createFileRoute("/_authed/workspace")({
  head: () => ({ meta: [{ title: "AEVOTRON — AI Workspace" }, { name: "description", content: "A focused workspace for connected AI models." }] }),
  component: WorkspaceChat,
});


function estimateTokens(messages) {
  return messages.reduce((total, message) => total + Math.ceil(String(message.content || "").length / 4), 0);
}

function selectContextMessages(messages, tokenBudget = 24_000) {
  const systemMessages = messages.filter((message) => message.role === "system").slice(0,5);
  const history = messages.filter((message) => message.role !== "system");
  const availableSlots = Math.max(1, 50 - systemMessages.length);
  const selected = [];
  let usedTokens = 0;
  for (let index = history.length - 1; index >= 0 && selected.length < availableSlots; index -= 1) {
    const message = history[index];
    const messageTokens = Math.ceil(String(message.content || "").length / 4);
    if (selected.length && usedTokens + messageTokens > tokenBudget) break;
    selected.unshift(message);
    usedTokens += messageTokens;
  }
  return [...systemMessages, ...selected];
}

function WorkspaceChat() {
  const { t } = useTranslation(["dashboard", "translation"]);
  const queryClient = useQueryClient();
  const demoMode = Boolean(readDemoUser());
  const sessionsQuery = useQuery({
    queryKey: ["workspace-chats"],
    queryFn: () => api.workspace.listChats(),
    enabled: !demoMode,
    retry: false,
    staleTime: 15_000,
  });
  const modelQuery = useQuery({
    queryKey: ["workspace-chat-models"],
    queryFn: async () => {
      const result = demoMode
        ? await api.groq.models()
        : await api.functions.invoke("provider-connections", { action: "models" });
      return result?.models || [];
    },
    enabled: true,
    retry: false,
    staleTime: 60_000,
  });
  const models = modelQuery.data || [];
  const [selectedModel, setSelectedModel] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [favoriteModels, setFavoriteModels] = useState([]);
  const [recentModels, setRecentModels] = useState([]);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const activeModel = models.find((model) => model.id === selectedModel) || models[0] || null;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState([]);
  const selectedAttachments = attachments.filter((file) => selectedAttachmentIds.includes(file.id));
  const [fileError, setFileError] = useState("");
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState([{ id: "current", title: t("New conversation"), messages: [] }]);
  const [activeConversation, setActiveConversation] = useState("current");
  const activeConversationRef = useRef("current");
  const skipSessionLoadRef = useRef(null);
  const [chatError, setChatError] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [metrics, setMetrics] = useState(null);
  const chatUsageQuery = useQuery({ queryKey: ["workspace-chat-usage", activeConversation], queryFn: () => api.workspace.getChatUsage(activeConversation), enabled: !demoMode && activeConversation !== "current", staleTime: 0, refetchOnWindowFocus: false });
  const sessionUsage = chatUsageQuery.data?.usage || null;
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareSelection, setCompareSelection] = useState([]);
  const [compareResults, setCompareResults] = useState([]);
  const [isComparing, setIsComparing] = useState(false);
  const compareControllersRef = useRef([]);
  const abortRef = useRef(null);
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const threadRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const modelContextLimit = Number(activeModel?.context_window || 0);
  const contextBudget = Number.isFinite(modelContextLimit) && modelContextLimit > 0
    ? Math.max(512, Math.min(24_000, modelContextLimit - 4_096))
    : 24_000;
  const contextMessages = useMemo(() => selectContextMessages(messages, contextBudget), [messages, contextBudget]);
  const contextEstimate = useMemo(() => estimateTokens(contextMessages), [contextMessages]);
  const filteredModels = models.filter((model) => {
    const query = modelSearch.trim().toLowerCase();
    return !query || model.id === activeModel?.id || [model.id, model.display_name, model.provider_code, model.provider_model_id, model.owned_by].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
  const favoriteOptions = filteredModels.filter((model) => favoriteModels.includes(model.id));
  const recentOptions = filteredModels.filter((model) => recentModels.includes(model.id) && !favoriteModels.includes(model.id));
  const otherOptions = filteredModels.filter((model) => !favoriteModels.includes(model.id) && !recentModels.includes(model.id));
  const providerGroups = [...new Set(otherOptions.map((model) => model.provider_code || "unknown"))];
  const modelCapabilities = activeModel?.capabilities || {};
  const modelDetails = [
    activeModel?.context_window ? Number(activeModel.context_window).toLocaleString() + " " + t("context tokens") : null,
    modelCapabilities.vision ? t("Vision") : null,
    modelCapabilities.tools ? t("Tools") : null,
    modelCapabilities.streaming === true ? t("Streaming") : modelCapabilities.streaming === false ? t("Streaming unavailable") : null,
  ].filter(Boolean);
  const isFavoriteModel = Boolean(activeModel && favoriteModels.includes(activeModel.id));
  const contextTruncated = contextMessages.length < messages.length;
  const filteredConversations = conversations.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    try {
      const favorites = JSON.parse(localStorage.getItem("aevotron.workspace.favorites") || "[]");
      const recent = JSON.parse(localStorage.getItem("aevotron.workspace.recent") || "[]");
      if (Array.isArray(favorites)) setFavoriteModels(favorites.filter((item) => typeof item === "string"));
      if (Array.isArray(recent)) setRecentModels(recent.filter((item) => typeof item === "string").slice(0,8));
    } catch { /* Ignore unavailable or malformed local preference storage. */ }
    finally { setPreferencesLoaded(true); }
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try { localStorage.setItem("aevotron.workspace.favorites", JSON.stringify(favoriteModels)); } catch { /* Preferences remain in memory. */ }
  }, [favoriteModels, preferencesLoaded]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try { localStorage.setItem("aevotron.workspace.recent", JSON.stringify(recentModels)); } catch { /* Preferences remain in memory. */ }
  }, [recentModels, preferencesLoaded]);

  useEffect(() => {
    if (!activeModel?.id) return;
    setRecentModels((current) => [activeModel.id, ...current.filter((id) => id !== activeModel.id)].slice(0,8));
  }, [activeModel?.id]);

  const toggleFavoriteModel = () => {
    if (!activeModel) return;
    setFavoriteModels((current) => current.includes(activeModel.id)
      ? current.filter((id) => id !== activeModel.id)
      : [activeModel.id, ...current]);
  };

  useEffect(() => {
    if (demoMode) return;
    const sessions = sessionsQuery.data?.sessions;
    if (!sessions) return;
    setConversations((current) => sessions.map((session) => ({
      ...session,
      messages: current.find((item) => item.id === session.id)?.messages || [],
    })));
    if (activeConversation === "current" && sessions.length) {
      activeConversationRef.current = sessions[0].id;
      setActiveConversation(sessions[0].id);
    }
  }, [demoMode, sessionsQuery.data, activeConversation]);

  useEffect(() => {
    const node = threadRef.current;
    if (node && shouldAutoScrollRef.current) node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (demoMode || !activeConversation || activeConversation === "current") return undefined;
    if (skipSessionLoadRef.current === activeConversation) { skipSessionLoadRef.current = null; return undefined; }
    let current = true;
    api.workspace.getChat(activeConversation).then((result) => {
      if (!current || activeConversationRef.current !== activeConversation) return;
      const loaded = result.messages || [];
      setMessages(loaded);
      setConversations((items) => items.map((item) => item.id === activeConversation ? { ...item, ...result.session, messages: loaded } : item));
    }).catch((error) => {
      if (current) setChatError(error.message || t("Could not load this conversation."));
    });
    return () => { current = false; };
  }, [activeConversation, demoMode, t]);

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setFileError("");
    setIsProcessingFiles(true);
    const allowed = new Set(["txt","md","markdown","csv","tsv","json","yaml","yml","xml","html","css","js","jsx","ts","tsx","py","go","rs","java","kt","sql","sh","bash","log","toml","ini"]);
    const currentCount = attachments.length;
    let totalCharacters = attachments.reduce((sum, item) => sum + item.text.length, 0);
    const accepted = [];
    try {
      for (const file of files) {
        if (currentCount + accepted.length >= 5) { setFileError(t("A maximum of five text attachments is allowed.")); break; }
        const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
        if (!allowed.has(extension)) { setFileError(t("This file type is not supported yet. Use plain text or source code files.")); continue; }
        if (file.size > 512 * 1024) { setFileError(t("Each text attachment must be 512 KB or smaller.")); continue; }
        const text = await file.text();
        const controlCharacters = [...text].filter((character) => {
          const code = character.charCodeAt(0);
          return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31);
        }).length;
        if (controlCharacters > Math.max(2, text.length * 0.01)) { setFileError(t("This file does not appear to be valid UTF-8 text.")); continue; }
        if (totalCharacters + text.length > 12_000) { setFileError(t("The combined text from attachments is limited to 12,000 characters.")); continue; }
        totalCharacters += text.length;
        accepted.push({ id: crypto.randomUUID(), name: file.name, size: file.size, text, tokens: Math.ceil(text.length / 4) });
      }
      if (accepted.length) {
        setAttachments((items) => [...items, ...accepted].slice(0,5));
        setSelectedAttachmentIds((items) => [...items, ...accepted.map((file) => file.id)]);
      }
    } catch (error) {
      setFileError(error.message || t("Could not read this attachment."));
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const updateAssistant = (id, updater, conversationId) => {
    if (activeConversationRef.current === conversationId) {
      setMessages((current) => current.map((item) => item.id === id ? updater(item) : item));
    }
    setConversations((items) => items.map((conversation) => conversation.id === conversationId
      ? { ...conversation, messages: conversation.messages.map((item) => item.id === id ? updater(item) : item) }
      : conversation));
  };

  const generate = async (baseMessages, { sessionId = activeConversation, persistUserMessage = true, replaceLastUserMessage = false } = {}) => {
    if (!activeModel) return;
    const assistantId = crypto.randomUUID();
    const assistant = { id: assistantId, role: "assistant", content: "", createdAt: Date.now() };
    const nextMessages = [...baseMessages, assistant];
    setMessages(nextMessages);
    setConversations((items) => items.map((item) => item.id === sessionId ? { ...item, messages: nextMessages } : item));
    setMetrics(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    try {
      const streamChat = demoMode ? api.groq.streamChat : api.workspace.streamChat;
      const result = await streamChat({
        model: activeModel.id,
        session_id: demoMode ? undefined : sessionId,
        persist_user_message: persistUserMessage,
        replace_last_user_message: replaceLastUserMessage,
        message_id: [...baseMessages].reverse().find((item) => item.role === "user")?.id,
        assistant_message_id: assistantId,
        messages: selectContextMessages(baseMessages, contextBudget).map(({ role, content }) => ({ role, content })),
        signal: controller.signal,
        onDelta: (delta) => updateAssistant(assistantId, (item) => ({ ...item, content: item.content + delta }), sessionId),
      });
      setMetrics(result);
      if (result.sessionId && result.sessionId !== sessionId) {
        activeConversationRef.current = result.sessionId;
        setActiveConversation(result.sessionId);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        updateAssistant(assistantId, (item) => ({ ...item, error: error.message || t("The response could not be completed.") }), sessionId);
      }
    } finally {
      if (sessionId && sessionId !== "current") queryClient.invalidateQueries({ queryKey: ["workspace-chat-usage", sessionId] });
      abortRef.current = null;
      setIsStreaming(false);
    }
  };

  const send = async (event) => {
    event?.preventDefault?.();
    const value = draft.trim();
    if ((!value && !selectedAttachments.length) || isStreaming || isProcessingFiles || !activeModel) return;
    const fileContext = selectedAttachments.map((file) => "[BEGIN UNTRUSTED ATTACHMENT " + JSON.stringify(file.name.replace(/[\r\n]/g, "_").replaceAll("[", "_").replaceAll("]", "_")) + "]\n" + file.text + "\n[END UNTRUSTED ATTACHMENT]").join("\n\n");
    const prompt = [value, fileContext].filter(Boolean).join("\n\n");
    const sentAttachmentIds = new Set(selectedAttachments.map((file) => file.id));
    if (prompt.length > 20_000) { setFileError(t("The message and attachments exceed the 20,000 character limit.")); return; }
    let sessionId = activeConversation;
    if (!demoMode && (!sessionId || sessionId === "current")) {
      try {
        const created = await api.workspace.createChat({ title: (value || selectedAttachments[0]?.name || t("New conversation")).slice(0, 100), model_id: activeModel.id });
        sessionId = created.session.id;
        skipSessionLoadRef.current = sessionId;
        activeConversationRef.current = sessionId;
        setActiveConversation(sessionId);
        setConversations((items) => [{ ...created.session, messages: [] }, ...items.filter((item) => item.id !== sessionId)]);
      } catch (error) {
        setChatError(error.message || t("Could not create a conversation."));
        return;
      }
    }
    const userMessage = { id: crypto.randomUUID(), role: "user", content: prompt, createdAt: Date.now() };
    shouldAutoScrollRef.current = true;
    const next = [...messages, userMessage];
    setMessages(next);
    setDraft("");
    setAttachments((items) => items.filter((file) => !sentAttachmentIds.has(file.id)));
    setSelectedAttachmentIds((items) => items.filter((id) => !sentAttachmentIds.has(id)));
    setFileError("");
    setConversations((items) => items.map((item) => item.id === sessionId
      ? { ...item, messages: next, title: item.title === t("New conversation") ? value.slice(0, 44) : item.title } : item));
    await generate(next, { sessionId });
  };

  const stop = () => abortRef.current?.abort();

  const regenerate = async () => {
    if (isStreaming) return;
    const lastUserIndex = messages.map((item) => item.role).lastIndexOf("user");
    if (lastUserIndex < 0) return;
    await generate(messages.slice(0, lastUserIndex + 1), { sessionId: activeConversation, persistUserMessage: false });
  };

  const saveEdit = async (messageId) => {
    if (isStreaming) return;
    const value = editValue.trim();
    if (!value) return;
    const index = messages.findIndex((item) => item.id === messageId);
    if (index < 0) return;
    const edited = { ...messages[index], content: value };
    const next = [...messages.slice(0, index), edited];
    setMessages(next);
    setConversations((items) => items.map((item) => item.id === activeConversation ? { ...item, messages: next } : item));
    setEditingId(null);
    await generate(next, { sessionId: activeConversation, persistUserMessage: false, replaceLastUserMessage: true });
  };

  const newConversation = async () => {
    if (isStreaming) stop();
    setChatError("");
    if (demoMode) {
      const id = crypto.randomUUID();
      setConversations((items) => [{ id, title: t("New conversation"), messages: [] }, ...items]);
      activeConversationRef.current = id;
      setActiveConversation(id);
    } else {
      try {
        const created = await api.workspace.createChat({ title: t("New conversation"), model_id: activeModel?.id });
        const session = { ...created.session, messages: [] };
        setConversations((items) => [session, ...items.filter((item) => item.id !== session.id)]);
        skipSessionLoadRef.current = session.id;
        activeConversationRef.current = session.id;
        setActiveConversation(session.id);
        sessionsQuery.refetch();
      } catch (error) {
        setChatError(error.message || t("Could not create a conversation."));
        return;
      }
    }
    shouldAutoScrollRef.current = true;
    setMessages([]);
    setMetrics(null);
    setDraft("");
    setAttachments([]);
    setSelectedAttachmentIds([]);
    setFileError("");
  };

  const selectConversation = (id) => {
    if (id === activeConversation) return;
    if (isStreaming) stop();
    setChatError("");
    activeConversationRef.current = id;
    shouldAutoScrollRef.current = true;
    setActiveConversation(id);
    shouldAutoScrollRef.current = true;
    setMessages(conversations.find((item) => item.id === id)?.messages || []);
    setAttachments([]);
    setSelectedAttachmentIds([]);
    setFileError("");
    setMetrics(null);

  };

  const branchFromMessage = async (message) => {
    if (demoMode || !activeConversation || activeConversation === "current") return;
    try {
      const result = await api.workspace.branchChat(activeConversation, message.id);
      const session = { ...result.session, messages: result.messages || [] };
      setConversations((items) => [session, ...items.filter((item) => item.id !== session.id)]);
      skipSessionLoadRef.current = session.id;
      activeConversationRef.current = session.id;
      setActiveConversation(session.id);
      shouldAutoScrollRef.current = true;
      setMessages(session.messages);
      setAttachments([]);
      setSelectedAttachmentIds([]);
      setFileError("");
      setMetrics(null);
      sessionsQuery.refetch();
    } catch (error) {
      setChatError(error.message || t("Could not create a branch."));
    }
  };

  const saveConversationTitle = async (id) => {
    const title = renameValue.trim();
    if (!title || title.length > 120) return;
    if (!demoMode) {
      try { await api.workspace.renameChat(id, title); }
      catch (error) { setChatError(error.message || t("Could not rename this conversation.")); return; }
    }
    setConversations((items) => items.map((item) => item.id === id ? { ...item, title } : item));
    setRenamingId(null);
  };

  const deleteConversation = async (id) => {
    if (isStreaming && id === activeConversation) stop();
    if (!demoMode) {
      try { await api.workspace.deleteChat(id); }
      catch (error) { setChatError(error.message || t("Could not delete this conversation.")); return; }
    }
    const remaining = conversations.filter((item) => item.id !== id);
    setConversations(remaining);
    if (id === activeConversation) {
      const next = remaining[0];
      const nextId = next?.id || "current";
      activeConversationRef.current = nextId;
      setActiveConversation(nextId);
      setMessages(next?.messages || []);
      setMetrics(null);
    }
    if (!demoMode) sessionsQuery.refetch();
  };

  const toggleCompareModel = (modelId) => {
    setCompareSelection((selected) => selected.includes(modelId)
      ? selected.filter((id) => id !== modelId)
      : selected.length < 4 ? [...selected, modelId] : selected);
  };

  const stopComparison = () => compareControllersRef.current.forEach((controller) => controller.abort());

  const runComparison = async () => {
    if (demoMode || isComparing || compareSelection.length < 2 || compareSelection.length > 4) return;
    const draftValue = draft.trim();
    const lastUserIndex = messages.map((item) => item.role).lastIndexOf("user");
    const history = lastUserIndex >= 0 ? messages.slice(0, lastUserIndex + 1) : [];
    const comparisonMessages = draftValue ? [...history, { role: "user", content: draftValue }] : history;
    if (!comparisonMessages.length) {
      setChatError(t("Enter a prompt or send a message before comparing models."));
      return;
    }
    const selected = models.filter((model) => compareSelection.includes(model.id));
    const controllers = selected.map(() => new AbortController());
    compareControllersRef.current = controllers;
    setCompareResults(selected.map((model) => ({ modelId: model.id, content: "", status: "streaming", metrics: null, error: null })));
    setIsComparing(true);
    setChatError("");
    await Promise.allSettled(selected.map(async (model, index) => {
      try {
        const result = await api.workspace.streamChat({
          model: model.id,
          messages: selectContextMessages(comparisonMessages, contextBudget).map(({ role, content }) => ({ role, content })),
          persist_conversation: false,
          persist_user_message: false,
          signal: controllers[index].signal,
          onDelta: (delta) => setCompareResults((items) => items.map((item) => item.modelId === model.id
            ? { ...item, content: item.content + delta } : item)),
        });
        setCompareResults((items) => items.map((item) => item.modelId === model.id ? { ...item, status: "complete", metrics: result } : item));
      } catch (error) {
        setCompareResults((items) => items.map((item) => item.modelId === model.id
          ? { ...item, status: error.name === "AbortError" ? "cancelled" : "error", error: error.name === "AbortError" ? null : error.message } : item));
      }
    }));
    compareControllersRef.current = [];
    setIsComparing(false);
  };

  const exportConversation = () => {
    if (!messages.length) return;
    const title = conversations.find((item) => item.id === activeConversation)?.title || "AEVOTRON conversation";
    const content = "# " + title + "\n\n" + messages.map((message) => {
      const speaker = message.role === "assistant" ? (activeModel?.provider_model_id || "Assistant") : t("You");
      return "## " + speaker + "\n\n" + (message.content || "") + (message.error ? "\n\n> " + message.error : "");
    }).join("\n\n---\n\n");
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    document.body.appendChild(anchor);
    anchor.download = (title.replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0,80) || "aevotron-conversation") + ".md";
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const providerName = activeModel?.provider_code === "groq" ? "Groq" : activeModel?.provider_code === "openai" ? "OpenAI" : "—";
  const outputTokens = metrics?.usage?.completion_tokens ?? metrics?.usage?.output_tokens ?? metrics?.estimatedOutputTokens;
  const generationMs = metrics?.elapsedMs ? Math.max(1, metrics.elapsedMs - (metrics.ttftMs || 0)) : 0;
  const tokenRate = outputTokens && generationMs ? (outputTokens / (generationMs / 1000)).toFixed(1) : "—";
  const sessionInputTokens = Number(sessionUsage?.total_input_tokens || 0);
  const sessionOutputTokens = Number(sessionUsage?.total_output_tokens || 0);
  const sessionRequestCount = Number(sessionUsage?.request_count || 0);
  const sessionCost = sessionUsage?.estimated_cost == null ? null : Number(sessionUsage.estimated_cost);
  const contextLimit = modelContextLimit;
  const contextRemaining = contextLimit ? Math.max(0, contextLimit - contextEstimate) : null;
  const contextLabel = contextLimit
    ? "~" + contextEstimate.toLocaleString() + " / " + contextLimit.toLocaleString() + " " + t("tokens") + " · ~" + contextRemaining.toLocaleString() + " " + t("remaining")
    : "~" + contextEstimate.toLocaleString() + " " + t("tokens") + " · " + t("limit unknown");

  return (
    <div className="aw-shell">
      <aside className="aw-sidebar">
        <div className="aw-brand"><span className="aw-brand-mark"><Command size={18}/></span><strong>AEVOTRON</strong><span className="aw-brand-beta">BETA</span></div>
        <button type="button" className="aw-new-chat" onClick={newConversation}><MessageSquarePlus size={16}/>{t("New chat")}<Plus size={15}/></button>
        <label className="aw-search"><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search conversations")} aria-label={t("Search conversations")}/></label>
        <div className="aw-history-label">{t("RECENT")}</div>
        <div className="aw-history">
          {filteredConversations.map((item) => renamingId === item.id
            ? <div className="aw-history-item" key={item.id}><input className="aw-history-rename-input" autoFocus value={renameValue} maxLength={120} aria-label={t("Rename conversation")} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveConversationTitle(item.id); if (event.key === "Escape") setRenamingId(null); }}/><button type="button" className="aw-history-rename-save" aria-label={t("Save")} onClick={() => saveConversationTitle(item.id)}><Check size={13}/></button></div>
            : <div className="aw-history-item" key={item.id}><button type="button" className={"aw-history-select" + (activeConversation === item.id ? " is-active" : "")} onClick={() => selectConversation(item.id)}><MessageSquarePlus size={15}/><span>{item.title}</span></button><button type="button" className="aw-history-rename" aria-label={t("Rename conversation") + ": " + item.title} title={t("Rename conversation")} onClick={() => {setRenamingId(item.id);setRenameValue(item.title);}}><Pencil size={12}/></button><button type="button" className="aw-history-delete" aria-label={t("Delete conversation") + ": " + item.title} title={t("Delete conversation")} onClick={() => deleteConversation(item.id)}><X size={13}/></button></div>)}
          {filteredConversations.length === 0 && <p className="aw-history-empty">{t("No conversations found")}</p>}
        </div>
        <div className="aw-sidebar-bottom">
          <div className="aw-sidebar-note"><Sparkles size={15}/><span>{t("One workspace for the models you connect.")}</span></div>
          <a href="/dashboard" className="aw-back-link">{t("Back to dashboard")}</a>
        </div>
      </aside>

      <main className="aw-main">
        <header className="aw-topbar">
          <div className="aw-topbar-title"><span>{t("Workspace")}</span><span className="aw-slash">/</span><strong>{t("AI chat")}</strong></div>
          <div className="aw-topbar-actions"><span className="aw-connection-state"><i/> {demoMode ? t("Demo mode") : t("Session protected")}</span>{messages.length > 0 && <button type="button" className="aw-export-button" onClick={exportConversation}><Download size={14}/>{t("Export")}</button>}<ThemeSwitcher/></div>
        </header>

        <section className="aw-content">
          <div className="aw-chat-heading">
            <div><div className="aw-eyebrow">{t("MODEL WORKSPACE")}</div><h1>{t("What would you like to work on?")}</h1><p>{t("Choose a connected model and start a focused conversation.")}</p></div>
            <div className="aw-heading-controls">
              <button className="aw-compare-toggle" type="button" onClick={() => {setCompareOpen((open) => !open);setCompareSelection((selected) => selected.length ? selected : models.slice(0,2).map((model) => model.id));}} disabled={models.length < 2 || demoMode || isStreaming}>{t("Compare models")} <span>2–4</span></button>
              <div className="aw-model-picker">
                <label htmlFor="aw-model-search">{t("MODEL")}</label>
                <input id="aw-model-search" className="aw-model-search" value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder={t("Search models")} aria-label={t("Search models")} disabled={!models.length}/>
                <div className="aw-model-select-wrap"><Bot size={16}/><select id="aw-model-select" value={activeModel?.id || ""} onChange={(event) => setSelectedModel(event.target.value)} disabled={!models.length || isStreaming}><option value="" disabled>{t("Select a model")}</option>{favoriteOptions.length > 0 && <optgroup label={t("Favorites")}>{favoriteOptions.map((model) => <option key={model.id} value={model.id}>{model.display_name || model.provider_model_id || model.id}</option>)}</optgroup>}{recentOptions.length > 0 && <optgroup label={t("Recently used")}>{recentOptions.map((model) => <option key={model.id} value={model.id}>{model.display_name || model.provider_model_id || model.id}</option>)}</optgroup>}{providerGroups.map((providerCode) => <optgroup key={providerCode} label={providerCode === "openai" ? "OpenAI" : providerCode === "groq" ? "Groq" : providerCode}>{otherOptions.filter((model) => (model.provider_code || "unknown") === providerCode).map((model) => <option key={model.id} value={model.id}>{model.display_name || model.provider_model_id || model.id}</option>)}</optgroup>)}{filteredModels.length === 0 && <option value="" disabled>{t("No models match your search")}</option>}</select><ChevronDown size={14}/></div>
                <div className="aw-model-picker-meta"><small>{activeModel ? providerName + " · " + t("Provider billing applies") : t("No connected models")}</small>{modelDetails.length > 0 ? <small className="aw-model-details">{modelDetails.join(" · ")}</small> : activeModel?.catalog_status === "unlisted" ? <small className="aw-model-details">{t("Model metadata not verified")}</small> : null}<button type="button" className={isFavoriteModel ? "aw-favorite-toggle is-favorite" : "aw-favorite-toggle"} onClick={toggleFavoriteModel} disabled={!activeModel} aria-pressed={isFavoriteModel}><Star size={13} fill={isFavoriteModel ? "currentColor" : "none"}/>{isFavoriteModel ? t("Pinned") : t("Add to favorites")}</button></div>
              </div>
            </div>
          </div>

          {compareOpen && <section className="aw-compare-panel">
            <div className="aw-compare-heading"><div><strong>{t("Compare model responses")}</strong><p>{t("Send the same prompt to 2–4 connected models in parallel. Each request is billed by its provider.")}</p></div><button type="button" onClick={() => {if(isComparing)stopComparison();setCompareOpen(false);}} aria-label={t("Close")}>×</button></div>
            <div className="aw-compare-models">{models.map((model) => <label key={model.id} className={compareSelection.includes(model.id) ? "is-selected" : ""}><input type="checkbox" checked={compareSelection.includes(model.id)} onChange={() => toggleCompareModel(model.id)} disabled={isComparing || (!compareSelection.includes(model.id) && compareSelection.length >= 4)}/><span><strong>{model.provider_code}</strong><small>{model.provider_model_id || model.id}</small></span></label>)}</div>
            <div className="aw-compare-actions"><span>{compareSelection.length} / 4 {t("models selected")}</span>{isComparing ? <button type="button" className="aw-compare-stop" onClick={stopComparison}><CircleStop size={14}/>{t("Stop comparison")}</button> : <button type="button" onClick={runComparison} disabled={compareSelection.length < 2 || !draft.trim() && !messages.some((item) => item.role === "user")}>{t("Compare now")}</button>}</div>
            {compareResults.length > 0 && <div className="aw-compare-results">{compareResults.map((item) => {const model=models.find((entry) => entry.id === item.modelId);return <article key={item.modelId} className="aw-compare-result"><div className="aw-compare-result-title"><strong>{model?.provider_model_id || item.modelId}</strong><span>{item.status === "streaming" ? t("Generating…") : item.status === "complete" ? t("Complete") : item.status === "cancelled" ? t("Stopped") : t("Failed")}</span></div><div className="aw-message-content">{item.content ? <ReactMarkdown>{item.content}</ReactMarkdown> : item.status === "streaming" ? <span className="aw-thinking">{t("Thinking")}<i/><i/><i/></span> : null}{item.error && <p className="aw-message-error">{item.error}</p>}</div>{item.metrics && <small>{t("TTFT")}: {item.metrics.ttftMs ?? "—"} ms · {t("Provider usage")}: {item.metrics.usage?.prompt_tokens ?? item.metrics.usage?.input_tokens ?? "—"} / {item.metrics.usage?.completion_tokens ?? item.metrics.usage?.output_tokens ?? "—"} · {t("Cost")}: {t("Not reported")}</small>}</article>;})}</div>}
          </section>}
          {chatError && <div className="aw-notice is-warning" role="alert"><X size={16}/><span>{chatError}</span><button type="button" onClick={() => setChatError("")}>{t("Dismiss")}</button></div>}
          {demoMode && <div className="aw-notice" role="status"><Sparkles size={16}/><span>{t("This is a local demo session. Connect a real account and provider to send live requests.")}</span><a href="/dashboard">{t("Open providers")}</a></div>}
          {!demoMode && modelQuery.isError && <div className="aw-notice is-warning" role="alert"><X size={16}/><span>{t("Could not load your connected models.")}</span><a href="/dashboard">{t("Manage providers")}</a></div>}
          {!demoMode && !modelQuery.isLoading && !models.length && <div className="aw-empty-models"><Bot size={26}/><h2>{t("No models connected yet")}</h2><p>{t("Connect OpenAI or Groq in your dashboard. Only models returned by your provider account appear here.")}</p><a href="/dashboard">{t("Open provider settings")}</a></div>}

          <div className={messages.length ? "aw-thread has-messages" : "aw-thread"} aria-live="polite">
            {messages.length === 0 ? <div className="aw-empty-state"><div className="aw-empty-icon"><Sparkles size={22}/></div><h2>{t("A clear space for your next idea.")}</h2><p>{t("Ask a question, explore an idea, or work through a technical problem.")}</p><div className="aw-prompt-suggestions">{[t("Explain a complex concept simply"),t("Review this code for potential issues"),t("Help me plan a technical project")].map((item) => <button key={item} type="button" onClick={() => {setDraft(item);composerRef.current?.focus();}} disabled={demoMode || !activeModel}>{item}<ArrowUp size={14}/></button>)}</div></div> : messages.map((message) => <article key={message.id} className={"aw-message aw-message-" + message.role}><div className="aw-message-avatar">{message.role === "assistant" ? <Bot size={16}/> : <span>Y</span>}</div><div className="aw-message-body"><div className="aw-message-meta"><strong>{message.role === "assistant" ? (activeModel?.provider_model_id || t("Assistant")) : t("You")}</strong>{message.role === "assistant" && <span>{providerName}</span>}</div>{editingId === message.id ? <div className="aw-edit-box"><textarea value={editValue} onChange={(event) => setEditValue(event.target.value)} rows={4}/><div><button type="button" onClick={() => setEditingId(null)}>{t("Cancel")}</button><button type="button" onClick={() => saveEdit(message.id)}>{t("Save and resend")}</button></div></div> : <div className="aw-message-content">{message.role === "assistant" && message.content ? <ReactMarkdown>{message.content}</ReactMarkdown> : message.content || (isStreaming && message.role === "assistant" ? <span className="aw-thinking">{t("Thinking")}<i/><i/><i/></span> : null)}{message.error && <p className="aw-message-error">{message.error}</p>}{message.role === "assistant" && message.error && !isStreaming && <button className="aw-message-action" type="button" onClick={regenerate}><RefreshCw size={13}/>{t("Retry")}</button>}</div>}{message.role === "user" && !isStreaming && message.id === messages.filter((item) => item.role === "user").slice(-1)[0]?.id && <button className="aw-message-action" type="button" onClick={() => {setEditingId(message.id);setEditValue(message.content);}}><Pencil size={13}/>{t("Edit")}</button>}{(message.role === "user" || (message.role === "assistant" && message.content)) && !isStreaming && !demoMode && <button className="aw-message-action" type="button" onClick={() => branchFromMessage(message)}><GitBranch size={13}/>{t("Branch here")}</button>}{message.role === "assistant" && message.content && !isStreaming && message.id === messages[messages.length - 1]?.id && <button className="aw-message-action" type="button" onClick={regenerate}><RefreshCw size={13}/>{t("Regenerate")}</button>}</div></article>)}
          </div>

          <form className="aw-composer" onSubmit={send} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {event.preventDefault();addFiles(event.dataTransfer?.files);}}>
            <input ref={fileInputRef} className="aw-hidden-file-input" type="file" multiple accept=".txt,.md,.markdown,.csv,.tsv,.json,.yaml,.yml,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.go,.rs,.java,.kt,.sql,.sh,.bash,.log,.toml,.ini" onChange={(event) => {addFiles(event.target.files);event.target.value="";}}/>
            {attachments.length > 0 && <div className="aw-attachment-list">{attachments.map((file) => <span className={"aw-attachment-chip" + (selectedAttachmentIds.includes(file.id) ? " is-selected" : "")} key={file.id}><label className="aw-attachment-select"><input type="checkbox" checked={selectedAttachmentIds.includes(file.id)} aria-label={t("Include attachment") + ": " + file.name} onChange={(event) => setSelectedAttachmentIds((items) => event.target.checked ? [...items, file.id] : items.filter((id) => id !== file.id))}/><FileText size={13}/><span>{file.name} · ~{file.tokens} {t("tokens")}</span></label><button type="button" aria-label={t("Remove attachment") + ": " + file.name} onClick={() => {setAttachments((items) => items.filter((item) => item.id !== file.id));setSelectedAttachmentIds((items) => items.filter((id) => id !== file.id));}}><X size={12}/></button></span>)}</div>}
            {fileError && <div className="aw-file-error" role="alert">{fileError}</div>}
            <textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {if (event.key === "Enter" && !event.shiftKey) {event.preventDefault();send();}}} onPaste={(event) => {const files = Array.from(event.clipboardData?.files || []);if(files.length){event.preventDefault();addFiles(files);}}} placeholder={demoMode ? t("Live chat is disabled in demo mode") : t("Message AEVOTRON…")} aria-label={t("Message AEVOTRON")} rows={2} disabled={demoMode || !activeModel || isStreaming}/>
            <div className="aw-composer-bottom"><div className="aw-composer-tools"><button className="aw-attach-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={demoMode || isStreaming || isProcessingFiles}><Paperclip size={14}/>{isProcessingFiles ? t("Reading files…") : t("Attach")}</button></div>{isStreaming ? <button className="aw-send-button is-stop" type="button" onClick={stop}><CircleStop size={16}/>{t("Stop")}</button> : <button className="aw-send-button" type="submit" disabled={(!draft.trim() && !selectedAttachments.length) || !activeModel || demoMode || isProcessingFiles}><ArrowUp size={17}/><span>{t("Send")}</span></button>}</div>
          </form>

          <div className="aw-statusbar">
            <div className="aw-status-model"><Bot size={14}/><strong>{activeModel?.provider_model_id || t("No model selected")}</strong><span>{providerName}</span></div>
            <div className="aw-status-metric"><FileText size={13}/><span>{t("Context estimate")}: {contextLabel}</span></div>{contextTruncated && <span className="aw-context-trimmed">{t("Older messages omitted from this request")}</span>}
            <div className="aw-status-metric"><Clock3 size={13}/><span>{t("TTFT")}: {metrics?.ttftMs != null ? metrics.ttftMs + " ms" : "—"}</span></div>
            {metrics?.usage && <div className="aw-status-metric"><FileText size={13}/><span>{t("Provider usage")}: {metrics.usage.prompt_tokens ?? metrics.usage.input_tokens ?? "—"} {t("input")} / {metrics.usage.completion_tokens ?? metrics.usage.output_tokens ?? "—"} {t("output")}</span></div>}
            <div className="aw-status-metric"><Sparkles size={13}/><span>{t("Output speed")}: {tokenRate === "—" ? "—" : (metrics?.usage ? "" : "~") + tokenRate + " tok/s"}</span></div>
            {sessionUsage && <div className="aw-status-metric"><FileText size={13}/><span>{t("Session usage")}: {sessionInputTokens.toLocaleString()} {t("input")} / {sessionOutputTokens.toLocaleString()} {t("output")} · {sessionRequestCount} {t("requests")}{sessionUsage.usage_estimated ? " · " + t("Estimated") : ""}</span></div>}
            <div className="aw-status-cost">{t("Cost")}: {sessionCost == null ? t("Not reported") : sessionCost.toFixed(4) + " " + (sessionUsage.currency || "USD")}</div>
          </div>
          <p className="aw-disclaimer">{t("Token counts are estimates unless the provider returns usage. Cost and context limits are not inferred.")} {t("Only plain text and source code files are parsed locally in this version.")}</p>
        </section>
      </main>
    </div>
  );
}
