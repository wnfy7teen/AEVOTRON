import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowUp, Bot, ChevronDown, CircleStop, Clock3, Command, FileText, MessageSquarePlus, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { api } from "@/api/client";
import { readDemoUser } from "@/lib/AuthContext";
import { ThemeSwitcher } from "@/lib/ThemeSwitcher";
import { LanguageSwitcher } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/workspace")({
  head: () => ({ meta: [{ title: "AEVOTRON — AI Workspace" }, { name: "description", content: "A focused workspace for connected AI models." }] }),
  component: WorkspaceChat,
});

const demoModels = [
  { id: "openai/gpt-4o-mini", provider_model_id: "gpt-4o-mini", provider_code: "openai", owned_by: "OpenAI" },
  { id: "openai/gpt-4o", provider_model_id: "gpt-4o", provider_code: "openai", owned_by: "OpenAI" },
  { id: "groq/llama-3.3-70b-versatile", provider_model_id: "llama-3.3-70b-versatile", provider_code: "groq", owned_by: "Meta" },
];

function estimateTokens(messages) {
  return messages.reduce((total, message) => total + Math.ceil(String(message.content || "").length / 4), 0);
}

function WorkspaceChat() {
  const { t } = useTranslation(["dashboard", "translation"]);
  const demoMode = Boolean(readDemoUser());
  const modelQuery = useQuery({
    queryKey: ["workspace-chat-models"],
    queryFn: async () => {
      const result = await api.functions.invoke("provider-connections", { action: "models" });
      return result?.models || [];
    },
    enabled: !demoMode,
    retry: false,
    staleTime: 60_000,
    initialData: demoMode ? demoModels : undefined,
  });
  const models = modelQuery.data || [];
  const [selectedModel, setSelectedModel] = useState("");
  const activeModel = models.find((model) => model.id === selectedModel) || models[0] || null;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState([{ id: "current", title: t("New conversation"), messages: [] }]);
  const [activeConversation, setActiveConversation] = useState("current");
  const [metrics, setMetrics] = useState(null);
  const abortRef = useRef(null);
  const composerRef = useRef(null);
  const contextEstimate = useMemo(() => estimateTokens(messages), [messages]);
  const filteredConversations = conversations.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));

  const updateAssistant = (id, updater) => {
    setMessages((current) => current.map((item) => item.id === id ? updater(item) : item));
    setConversations((items) => items.map((conversation) => conversation.id === activeConversation
      ? { ...conversation, messages: conversation.messages.map((item) => item.id === id ? updater(item) : item) }
      : conversation));
  };

  const generate = async (baseMessages) => {
    if (!activeModel || demoMode) return;
    const assistantId = crypto.randomUUID();
    const assistant = { id: assistantId, role: "assistant", content: "", createdAt: Date.now() };
    const nextMessages = [...baseMessages, assistant];
    setMessages(nextMessages);
    setConversations((items) => items.map((item) => item.id === activeConversation ? { ...item, messages: nextMessages } : item));
    setMetrics(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    try {
      const result = await api.workspace.streamChat({
        model: activeModel.id,
        messages: baseMessages.map(({ role, content }) => ({ role, content })),
        signal: controller.signal,
        onDelta: (delta) => updateAssistant(assistantId, (item) => ({ ...item, content: item.content + delta })),
      });
      setMetrics(result);
    } catch (error) {
      if (error.name !== "AbortError") {
        updateAssistant(assistantId, (item) => ({ ...item, error: error.message || t("The response could not be completed.") }));
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  };

  const send = async (event) => {
    event?.preventDefault?.();
    const value = draft.trim();
    if (!value || isStreaming || !activeModel || demoMode) return;
    const userMessage = { id: crypto.randomUUID(), role: "user", content: value, createdAt: Date.now() };
    const next = [...messages, userMessage];
    setMessages(next);
    setDraft("");
    setConversations((items) => items.map((item) => item.id === activeConversation
      ? { ...item, messages: next, title: item.title === t("New conversation") ? value.slice(0, 44) : item.title } : item));
    await generate(next);
  };

  const stop = () => abortRef.current?.abort();

  const regenerate = async () => {
    if (isStreaming) return;
    const lastUserIndex = messages.map((item) => item.role).lastIndexOf("user");
    if (lastUserIndex < 0) return;
    await generate(messages.slice(0, lastUserIndex + 1));
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
    await generate(next);
  };

  const newConversation = () => {
    if (isStreaming) stop();
    const id = crypto.randomUUID();
    setConversations((items) => [{ id, title: t("New conversation"), messages: [] }, ...items]);
    setActiveConversation(id);
    setMessages([]);
    setMetrics(null);
    setDraft("");
  };

  const selectConversation = (id) => {
    if (id === activeConversation) return;
    if (isStreaming) stop();
    setActiveConversation(id);
    setMessages(conversations.find((item) => item.id === id)?.messages || []);
    setMetrics(null);
  };

  const providerName = activeModel?.provider_code === "groq" ? "Groq" : activeModel?.provider_code === "openai" ? "OpenAI" : "—";
  const outputTokens = metrics?.usage?.completion_tokens ?? metrics?.usage?.output_tokens ?? metrics?.estimatedOutputTokens;
  const tokenRate = outputTokens && metrics?.elapsedMs ? (outputTokens / (metrics.elapsedMs / 1000)).toFixed(1) : "—";

  return (
    <div className="aw-shell">
      <aside className="aw-sidebar">
        <div className="aw-brand"><span className="aw-brand-mark"><Command size={18}/></span><strong>AEVOTRON</strong><span className="aw-brand-beta">BETA</span></div>
        <button type="button" className="aw-new-chat" onClick={newConversation}><MessageSquarePlus size={16}/>{t("New chat")}<Plus size={15}/></button>
        <label className="aw-search"><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search conversations")} aria-label={t("Search conversations")}/></label>
        <div className="aw-history-label">{t("RECENT")}</div>
        <div className="aw-history">
          {filteredConversations.map((item) => <button key={item.id} type="button" className={activeConversation === item.id ? "is-active" : ""} onClick={() => selectConversation(item.id)}><MessageSquarePlus size={15}/><span>{item.title}</span><MoreHorizontal size={15}/></button>)}
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
          <div className="aw-topbar-actions"><span className="aw-connection-state"><i/> {demoMode ? t("Demo mode") : t("Session protected")}</span><LanguageSwitcher/><ThemeSwitcher/></div>
        </header>

        <section className="aw-content">
          <div className="aw-chat-heading">
            <div><div className="aw-eyebrow">{t("MODEL WORKSPACE")}</div><h1>{t("What would you like to work on?")}</h1><p>{t("Choose a connected model and start a focused conversation.")}</p></div>
            <div className="aw-model-picker">
              <label htmlFor="aw-model-select">{t("MODEL")}</label>
              <div className="aw-model-select-wrap"><Bot size={16}/><select id="aw-model-select" value={activeModel?.id || ""} onChange={(event) => setSelectedModel(event.target.value)} disabled={!models.length || isStreaming}><option value="" disabled>{t("Select a model")}</option>{models.map((model) => <option key={model.id} value={model.id}>{model.id}</option>)}</select><ChevronDown size={14}/></div>
              <small>{activeModel ? providerName + " · " + t("Provider billing applies") : t("No connected models")}</small>
            </div>
          </div>

          {demoMode && <div className="aw-notice" role="status"><Sparkles size={16}/><span>{t("This is a local demo session. Connect a real account and provider to send live requests.")}</span><a href="/dashboard">{t("Open providers")}</a></div>}
          {!demoMode && modelQuery.isError && <div className="aw-notice is-warning" role="alert"><X size={16}/><span>{t("Could not load your connected models.")}</span><a href="/dashboard">{t("Manage providers")}</a></div>}
          {!demoMode && !modelQuery.isLoading && !models.length && <div className="aw-empty-models"><Bot size={26}/><h2>{t("No models connected yet")}</h2><p>{t("Connect OpenAI or Groq in your dashboard. Only models returned by your provider account appear here.")}</p><a href="/dashboard">{t("Open provider settings")}</a></div>}

          <div className={messages.length ? "aw-thread has-messages" : "aw-thread"} aria-live="polite">
            {messages.length === 0 ? <div className="aw-empty-state"><div className="aw-empty-icon"><Sparkles size={22}/></div><h2>{t("A clear space for your next idea.")}</h2><p>{t("Ask a question, explore an idea, or work through a technical problem.")}</p><div className="aw-prompt-suggestions">{[t("Explain a complex concept simply"),t("Review this code for potential issues"),t("Help me plan a technical project")].map((item) => <button key={item} type="button" onClick={() => {setDraft(item);composerRef.current?.focus();}} disabled={demoMode || !activeModel}>{item}<ArrowUp size={14}/></button>)}</div></div> : messages.map((message) => <article key={message.id} className={"aw-message aw-message-" + message.role}><div className="aw-message-avatar">{message.role === "assistant" ? <Bot size={16}/> : <span>Y</span>}</div><div className="aw-message-body"><div className="aw-message-meta"><strong>{message.role === "assistant" ? (activeModel?.provider_model_id || t("Assistant")) : t("You")}</strong>{message.role === "assistant" && <span>{providerName}</span>}</div>{editingId === message.id ? <div className="aw-edit-box"><textarea value={editValue} onChange={(event) => setEditValue(event.target.value)} rows={4}/><div><button type="button" onClick={() => setEditingId(null)}>{t("Cancel")}</button><button type="button" onClick={() => saveEdit(message.id)}>{t("Save and resend")}</button></div></div> : <div className="aw-message-content">{message.content || (isStreaming && message.role === "assistant" ? <span className="aw-thinking">{t("Thinking")}<i/><i/><i/></span> : null)}{message.error && <p className="aw-message-error">{message.error}</p>}</div>}{message.role === "user" && !isStreaming && <button className="aw-message-action" type="button" onClick={() => {setEditingId(message.id);setEditValue(message.content);}}><Pencil size={13}/>{t("Edit")}</button>}{message.role === "assistant" && message.content && !isStreaming && message.id === messages[messages.length - 1]?.id && <button className="aw-message-action" type="button" onClick={regenerate}><RefreshCw size={13}/>{t("Regenerate")}</button>}</div></article>)}
          </div>

          <form className="aw-composer" onSubmit={send}>
            <textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {if (event.key === "Enter" && !event.shiftKey) {event.preventDefault();send();}}} placeholder={demoMode ? t("Live chat is disabled in demo mode") : t("Message AEVOTRON…")} aria-label={t("Message AEVOTRON")} rows={2} disabled={demoMode || !activeModel || isStreaming}/>
            <div className="aw-composer-bottom"><span>{t("Enter to send · Shift + Enter for a new line")}</span>{isStreaming ? <button className="aw-send-button is-stop" type="button" onClick={stop}><CircleStop size={16}/>{t("Stop")}</button> : <button className="aw-send-button" type="submit" disabled={!draft.trim() || !activeModel || demoMode}><ArrowUp size={17}/><span>{t("Send")}</span></button>}</div>
          </form>

          <div className="aw-statusbar">
            <div className="aw-status-model"><Bot size={14}/><strong>{activeModel?.provider_model_id || t("No model selected")}</strong><span>{providerName}</span></div>
            <div className="aw-status-metric"><FileText size={13}/><span>{t("Context estimate")}: ~{contextEstimate.toLocaleString()} {t("tokens")}</span></div>
            <div className="aw-status-metric"><Clock3 size={13}/><span>{t("TTFT")}: {metrics?.ttftMs != null ? metrics.ttftMs + " ms" : "—"}</span></div>
            <div className="aw-status-metric"><Sparkles size={13}/><span>{t("Output speed")}: {tokenRate === "—" ? "—" : "~" + tokenRate + " tok/s"}</span></div>
            <div className="aw-status-cost">{t("Cost")}: {t("Not reported")}</div>
          </div>
          <p className="aw-disclaimer">{t("Token counts are estimates unless the provider returns usage. Cost and context limits are not inferred.")}</p>
        </section>
      </main>
    </div>
  );
}
