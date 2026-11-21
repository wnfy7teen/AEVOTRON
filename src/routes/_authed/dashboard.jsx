import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateForLanguage } from "@/i18n";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { readDemoUser } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/i18n";
import { ThemeSwitcher, setAppTheme } from "@/lib/ThemeSwitcher";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Dropdown } from "@/components/ui/Dropdown";
import { Activity, ArrowDownUp, ArrowUpRight, Bell, BookOpen, Boxes, Check, ChevronDown, CircleHelp, Code2, Command, Copy, Cpu, CreditCard, Globe2, KeyRound, Layers3, LayoutDashboard, LockKeyhole, Menu, Plus, Search, Settings2, ShieldCheck, Terminal, Zap, Users, Wallet, UserRound, Shield, SlidersHorizontal, Palette, Trash2, Sun, Moon, Monitor, Mail, Webhook, Clock, X, CircleDollarSign } from "lucide-react";

const invokeFunction = async (name, payload) => {
  const response = await api.functions.invoke(name, payload);
  return response?.data ?? response;
};

export const Route = createFileRoute("/_authed/dashboard")({
  head: ({ matches }) => { const locale = matches.find((match) => match.routeId === "__root__")?.loaderData || "en"; return { meta: [{ title: translateForLanguage(locale, "Aevotron — Workspace") }, { name: "description", content: translateForLanguage(locale, "One API for every AI model.") }] }; },
  // Keep HomePage in this module: PreviewDashboard also reuses it on a public preview route.
  // An inline wrapper prevents route auto-splitting from moving the component out of this module.
  component: () => <HomePage />,
});

const modelDescriptions = {
  "gpt-4o": "model.description.gpt4o",
  "gpt-4o-mini": "model.description.gpt4oMini",
  "gpt-4.1": "model.description.gpt41",
  "gpt-4.1-mini": "model.description.gpt41Mini",
  "gpt-4.1-nano": "model.description.gpt41Nano",
  "o3": "model.description.o3",
  "o3-mini": "model.description.o3Mini",
  "o4-mini": "model.description.o4Mini",
};

function describeModel(id) {
  const key = String(id || "").toLowerCase();
  if (modelDescriptions[key]) return modelDescriptions[key];
  if (/^o[1-9](?:-|$)/.test(key)) return "model.description.reasoning";
  if (key.includes("mini") || key.includes("nano")) return "model.description.lightweight";
  return "model.description.default";
}

const providers = [
  { name: "OpenAI", detail: "GPT models, embeddings, audio", color: "green", letter: "O" },
  { name: "Anthropic", detail: "Claude models", color: "orange", letter: "A" },
  { name: "Google AI", detail: "Gemini models", color: "blue", letter: "G" },
  { name: "DeepSeek", detail: "DeepSeek chat models", color: "cyan", letter: "D" },
  { name: "OpenAI-compatible", detail: "Any compatible endpoint", color: "purple", letter: "↗" },
];

export function PreviewDashboard() {
  return <HomePage preview />;
}

function HomePage({ preview = false }) {
  const { t, i18n: activeI18n } = useTranslation(["dashboard", "translation"]);
  const currentLanguage = activeI18n.resolvedLanguage || activeI18n.language;
  const accountQuery = useQuery({
    queryKey: ["workspace-account-profile"],
    queryFn: () => readDemoUser() || api.auth.me(),
    staleTime: 60_000,
    retry: false,
    enabled: !preview,
  });
  const accountName = accountQuery.data?.display_name || accountQuery.data?.email?.split("@")[0] || (preview ? t("Preview user") : t("Account"));
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || "A";
  const usageQuery = useQuery({
    queryKey: ["usage-summary"],
    queryFn: () => invokeFunction("usage", { action: "summary" }),
    staleTime: 30_000,
    retry: 1,
    enabled: !preview,
    initialData: preview ? { workspace: { name: "Christopher's workspace", region: "global" }, summary: { requests: 1248, average_latency_ms: 382 } } : undefined,
  });
  const workspaceLabel = usageQuery.data?.workspace?.name ?? (usageQuery.isPending ? t("Loading workspace…") : t("Workspace unavailable"));
  const modelQuery = useQuery({
    queryKey: ["provider-models"],
    queryFn: () => invokeFunction("provider-connections", { action: "models" }),
    staleTime: 300_000,
    retry: 1,
    enabled: !preview,
    initialData: preview ? { models: [
      { id: "openai/gpt-4o-mini", provider_model_id: "gpt-4o-mini", provider_code: "openai", owned_by: "OpenAI" },
      { id: "openai/gpt-4o", provider_model_id: "gpt-4o", provider_code: "openai", owned_by: "OpenAI" },
      { id: "groq/llama-3.3-70b-versatile", provider_model_id: "llama-3.3-70b-versatile", provider_code: "groq", owned_by: "Meta" },
      { id: "groq/openai/gpt-oss-20b", provider_model_id: "openai/gpt-oss-20b", provider_code: "groq", owned_by: "OpenAI" },
    ] } : undefined,
  });
  const models = useMemo(() => (modelQuery.data?.models || []).map((model) => {
    const provider = model.provider_code === "groq" ? "Groq" : "OpenAI";
    return {
      name: model.id, description: t(describeModel(model.provider_model_id || model.id)), provider, type: "Chat", category: /^o[1-9](?:-|$)|reasoning/i.test(model.provider_model_id || model.id) ? "Reasoning" : /code|coder/i.test(model.provider_model_id || model.id) ? "Coding" : /mini|nano|small/i.test(model.provider_model_id || model.id) ? "Lightweight" : "General", context: "Provider-defined",
      speed: "Provider API", price: "Direct provider billing",
      tags: [model.owned_by || provider], color: model.provider_code === "groq" ? "orange" : "green", status: "BYOK",
    };
  }), [modelQuery.data, activeI18n.resolvedLanguage]);
  const [section, setSection] = useState("Overview");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All models");
  const [providerFilter, setProviderFilter] = useState("All providers");
  const [categoryFilter, setCategoryFilter] = useState("All models");
  const [selected, setSelected] = useState("");
  const [copied, setCopied] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const categories = useMemo(() => ["General", "Reasoning", "Coding", "Lightweight"].filter(category => models.some(model => model.category === category)), [models]);
  const filtered = useMemo(() => models.filter(m => (filter === "All models" || m.type === filter) && (providerFilter === "All providers" || m.provider === providerFilter) && (categoryFilter === "All models" || m.category === categoryFilter) && (m.name + m.provider + m.tags.join(" ")).toLowerCase().includes(query.toLowerCase())), [models, filter, providerFilter, categoryFilter, query]);
  const active = models.find(m => m.name === selected) || models[0] || null;
  const nav = [{ label: "WORKSPACE", items: [{ name: "Overview", icon: LayoutDashboard }, { name: "Model catalog", icon: Boxes }, { name: "API keys", icon: KeyRound }, { name: "Usage & logs", icon: Activity }, { name: "Billing", icon: Wallet }, { name: "Team & projects", icon: Users }, { name: "Notifications", icon: Bell }] }, { label: "DEVELOPERS", items: [{ name: "Quickstart", icon: Terminal }, { name: "API reference", icon: BookOpen }] }, { label: "SETTINGS", items: [{ name: "Providers", icon: Layers3 }, { name: "Preferences", icon: Settings2 }] }];
  const apiEndpoint = typeof window !== "undefined"
    ? `${window.location.origin}/v1/chat/completions`
    : "https://aevotron.vercel.app/v1/chat/completions";
  const code = `curl ${apiEndpoint} \\\n  -H "Authorization: Bearer YOUR_AEVOTRON_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "${active?.name || "gpt-4o-mini"}",\n    "messages": [{"role":"user","content":"Hello!"}]\n  }'`;
  const copyCode = async () => { try { if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable"); await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } };
  return (
    <div className={`mh-shell ${preview ? "mh-shell-preview" : ""}`} data-language={currentLanguage}>
      <aside className={`mh-sidebar ${mobileNav ? "mh-sidebar-open" : ""}`}>
        <div className="mh-brand"><div className="mh-brand-mark"><Command size={19}/></div><span>AEVOTRON</span><span className="mh-beta">BETA</span></div>
        <div className="mh-workspace"><div className="mh-workspace-icon">C</div><div><strong>{workspaceLabel}</strong><small>{usageQuery.data?.workspace?.region?.toUpperCase() ?? t("Personal workspace")}</small></div><ChevronDown size={15}/></div>
        {nav.map(group => <div className="mh-nav-group" key={group.label}><div className="mh-nav-label">{t(group.label)}</div>{group.items.map(item => <button key={item.name}  className={`mh-nav-item ${section === item.name ? "active" : ""}`} onClick={() => {setSection(item.name);setMobileNav(false)}}><item.icon size={17}/><span>{t(item.name)}</span>{item.name === "API keys" && <span className="mh-nav-count">0</span>}</button>)}</div>)}
        <div className="mh-sidebar-bottom"><div className="mh-usage-mini"><div className="mh-usage-top"><span>{t("Free plan")}</span><span>{t("0 / 1,000 req")}</span></div><div className="mh-progress"><i/></div><small>{t("Bring your own provider keys to get started.")}</small></div><button className="mh-profile" type="button" aria-label={t("Open workspace preferences")} onClick={() => {setSection("Preferences");setMobileNav(false)}}><div className="mh-avatar">{accountInitial}</div><div><strong>{accountName}</strong><small>{accountQuery.data?.email || (preview ? t("Read-only preview") : t("Account profile"))}</small></div><Settings2 size={16}/></button></div>
      </aside>
      <main className="mh-main">
        <header className="mh-topbar"><button className="mh-mobile-menu" type="button" aria-label={mobileNav ? t("Close navigation") : t("Open navigation")} aria-expanded={mobileNav} onClick={() => setMobileNav(!mobileNav)}><Menu size={20}/></button><div className="mh-breadcrumb">{t("Workspace")} <span>/</span> <strong>{t(section)}</strong></div><div className="mh-top-actions"><div className="mh-region"><Globe2 size={14}/> {t("Global")} <ChevronDown size={13}/></div><button className="mh-icon-button" type="button" aria-label={t("Open API reference")} title={t("API reference")} onClick={() => setSection("API reference")}><CircleHelp size={17}/></button><ThemeSwitcher /><div className="mh-avatar small">{accountInitial}</div></div></header>
        <div className="mh-content">
          {preview && <div className="mh-preview-banner"><span className="mh-preview-dot"/><div><strong>{t("Workspace preview")}</strong><small>{t("Sample data · Read-only mode · No account or backend connection required")}</small></div><span className="mh-preview-label">PREVIEW</span></div>}
          {section === "Overview" && <>
            <div className="mh-page-heading"><div><div className="mh-eyebrow"><span className="mh-live-dot"/> {t("AI INFRASTRUCTURE, SIMPLIFIED")}</div><h1>{t("Your models. One API.")}</h1><p>{t("Connect your AI providers once. Route text chat requests through a single API.")}</p></div><button className="mh-button mh-button-primary" disabled={preview} onClick={() => setSection("Providers")}><Plus size={16}/> {t("Connect provider")}</button></div>
            <div className="mh-stats"><Stat icon={Activity} label="Requests (30 days)" value={usageQuery.data?.summary?.requests ?? "—"} note="Recorded by the gateway"/><Stat icon={Cpu} label="Models in catalog" value={modelQuery.isLoading ? "…" : models.length} note={models.length ? "Available from connected providers" : "Connect a provider to discover models"}/><Stat icon={Zap} label="Avg. latency" value={usageQuery.data?.summary?.average_latency_ms ? `${usageQuery.data.summary.average_latency_ms} ms` : "—"} note="Last 30 days"/><Stat icon={CreditCard} label="Provider billing" value="Direct" note="Billed by the connected provider"/></div>
            <div className="mh-section-heading"><div><h2>{t("Get started")}</h2><p>{t("Three steps to your first API call.")}</p></div><span className="mh-step-count">{t("0 of 3 complete")}</span></div>
            <div className="mh-steps"><Step number="01" title={t("Connect a provider")} desc={t("Add your own API key. It stays private and is never shown in the browser again.")} action={t("Add provider")} onClick={() => setSection("Providers")} icon={KeyRound} disabled={preview}/><Step number="02" title={t("Create an AEVOTRON key")} desc={t("Generate a single key for your apps and services to authenticate requests.")} action={t("Create API key")} onClick={() => setSection("API keys")} icon={LockKeyhole} disabled={preview}/><Step number="03" title={t("Make your first request")} desc={t("Use our OpenAI-compatible endpoint with any supported model.")} action={t("View quickstart")} onClick={() => setSection("Quickstart")} icon={Code2} disabled={preview}/></div>
            <div className="mh-bottom-grid"><div className="mh-panel"><div className="mh-panel-heading"><div><h3>{t("Popular models")}</h3><p>{t("Start exploring the catalog")}</p></div><button className="mh-text-link" onClick={() => setSection("Model catalog")}>{t("View all")} <ArrowUpRight size={14}/></button></div>{models.slice(0,4).map(m => <ModelRow key={m.name} model={m} disabled={preview} onClick={() => {setSelected(m.name);setSection("Model catalog")}}/>)}{models.length === 0 && <div className="mh-empty">{modelQuery.isLoading ? "Loading models from OpenAI…" : "Connect a provider to load the models available to your account."}</div>}</div><div className="mh-panel mh-code-panel"><div className="mh-panel-heading"><div><h3>{t("Quick API example")}</h3><p>{t("OpenAI-compatible interface")}</p></div><span className="mh-code-language">cURL</span></div><pre className="mh-code"><code>{code}</code></pre><button className="mh-copy-button" onClick={copyCode}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? t("Copied") : t("Copy example")}</button></div></div>
            <div className="mh-trust-note"><ShieldCheck size={17}/><span><strong>{t("Your keys, your control.")}</strong> {t("Provider credentials are sent over HTTPS, encrypted before storage and never shown again.")}</span></div>
          </>}
          {section === "Model catalog" && <><div className="mh-page-heading"><div><div className="mh-eyebrow"><span className="mh-live-dot"/> {t("MODEL DISCOVERY")}</div><h1>{t("Model catalog")}</h1><p>{t("Find the right model for every workload. Compare providers and explore what your keys can access.")}</p></div><button className="mh-button mh-button-primary" onClick={() => setSection("Providers")}><Plus size={15}/> {t("Manage providers")}</button></div><div className="mh-catalog-overview"><div className="mh-catalog-overview-main"><div className="mh-catalog-overview-copy"><span>{t("YOUR MODEL INVENTORY")}</span><strong>{models.length ? t("One gateway. Multiple model providers.") : t("Your model workspace starts here.")}</strong><p>{models.length ? t("Browse the models returned by your connected provider accounts. Availability follows your provider credentials.") : t("Connect a provider to populate this catalog with models available to your account.")}</p></div><div className="mh-catalog-overview-stats"><div><strong>{models.length}</strong><span>{t("Available models")}</span></div><div><strong>{new Set(models.map(m=>m.provider)).size}</strong><span>{t("Providers")}</span></div><div><strong>{categories.length}</strong><span>{t("Model families")}</span></div></div></div><div className="mh-catalog-provider-strip"><span>{t("CONNECTED SOURCES")}</span>{[...new Set(models.map(m=>m.provider))].map(provider=><button key={provider} className={providerFilter===provider?"active":""} onClick={()=>setProviderFilter(providerFilter===provider?"All providers":provider)}><i className={`mh-provider-dot ${provider==="Groq"?"orange":"green"}`}/>{provider}<small>{models.filter(m=>m.provider===provider).length}</small></button>)}{models.length===0 && <span className="mh-catalog-no-sources">{t("No providers connected yet")}</span>}<button className="mh-catalog-add-source" onClick={()=>setSection("Providers")}><Plus size={13}/>{t("Add source")}</button></div></div><div className="mh-catalog-workspace"><section className="mh-catalog-browser"><div className="mh-catalog-browser-head"><div><h2>{t("Explore models")}</h2><p>{t("Filter by provider or model family.")}</p></div><span className="mh-catalog-result-count">{filtered.length} {t("results")}</span></div><div className="mh-catalog-controls"><div className="mh-search"><Search size={17}/><input aria-label={t("Search models")} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("Search model IDs, providers, or owners...")}/></div><button className="mh-button mh-button-quiet" onClick={() => modelQuery.refetch()} disabled={modelQuery.isFetching}><ArrowDownUp size={15}/> {modelQuery.isFetching ? t("Refreshing…") : t("Refresh")}</button></div><div className="mh-catalog-filter-row"><div className="mh-catalog-filter-label">{t("PROVIDER")}</div><div className="mh-provider-filters"><button type="button" className={providerFilter==="All providers"?"active":""} onClick={()=>setProviderFilter("All providers")}>{t("All providers")}</button>{[...new Set(models.map(m=>m.provider))].map(provider=><button type="button" key={provider} className={providerFilter===provider?"active":""} onClick={()=>setProviderFilter(provider)}>{provider}</button>)}</div></div><div className="mh-catalog-filter-row"><div className="mh-catalog-filter-label">{t("MODEL FAMILY")}</div><div className="mh-provider-filters"><button type="button" className={categoryFilter==="All models"?"active":""} onClick={()=>setCategoryFilter("All models")}>{t("All models")}</button>{categories.map(category=><button type="button" key={category} className={categoryFilter===category?"active":""} onClick={()=>setCategoryFilter(category)}>{t(category)}</button>)}</div></div><div className="mh-model-card-grid">{filtered.map(m=><button key={m.name} type="button" className={`mh-model-card ${active?.name===m.name?"selected":""}`} onClick={()=>setSelected(m.name)} aria-pressed={active?.name===m.name}><div className="mh-model-card-top"><span className={`mh-model-card-brand ${m.color}`}>{m.provider==="Groq"?"G":"O"}</span><span className="mh-model-card-provider">{m.provider}</span><span className="mh-model-card-access">{t("BYOK")}</span></div><strong className="mh-model-card-name">{m.name}</strong><p>{m.description}</p><div className="mh-model-card-bottom"><span>{t(m.category)}</span><span>{t("View details")} <ArrowUpRight size={12}/></span></div></button>)}</div>{modelQuery.isLoading && <div className="mh-catalog-empty"><div className="mh-catalog-empty-icon"><Cpu size={20}/></div><strong>{t("Discovering models")}</strong><p>{t("Loading the models exposed by your connected providers.")}</p></div>}{modelQuery.isError && <div className="mh-catalog-empty" role="alert"><div className="mh-catalog-empty-icon"><CircleHelp size={20}/></div><strong>{t("Model list is unavailable")}</strong><p>{t("Could not load models from your provider. Check the connection and try again.")}</p><button className="mh-button mh-button-quiet" onClick={()=>modelQuery.refetch()}>{t("Try again")}</button></div>}{!modelQuery.isLoading && !modelQuery.isError && models.length===0 && <div className="mh-catalog-empty"><div className="mh-catalog-empty-icon"><Layers3 size={20}/></div><strong>{t("No models yet")}</strong><p>{t("Connect OpenAI or Groq to discover the chat models available to your API key. Provider credentials remain encrypted.")}</p><button className="mh-button mh-button-primary" onClick={()=>setSection("Providers")}><Plus size={14}/>{t("Connect a provider")}</button></div>}{models.length>0 && filtered.length===0 && <div className="mh-catalog-empty"><div className="mh-catalog-empty-icon"><Search size={20}/></div><strong>{t("No matching models")}</strong><p>{t("Try another search or clear your filters.")}</p><button className="mh-button mh-button-quiet" onClick={()=>{setQuery("");setProviderFilter("All providers");setCategoryFilter("All models");setFilter("All models");}}>{t("Clear all filters")}</button></div>}</section><aside className="mh-catalog-side"><div className="mh-panel mh-model-detail">{active ? <><div className="mh-detail-top"><span className={`mh-provider-dot large ${active.color}`}/><span className="mh-status byok">BYOK</span></div><div className="mh-detail-provider">{active.provider} · {t(active.category)}</div><h2>{active.name}</h2><p className="mh-model-description-detail">{active.description}</p><div className="mh-detail-stats"><div><small>{t("Model family")}</small><strong>{t(active.category)}</strong></div><div><small>{t("Availability")}</small><strong>{t("From provider")}</strong></div><div><small>{t("Billing")}</small><strong>{t("Provider direct")}</strong></div></div><div className="mh-model-detail-meta"><span>{t("MODEL OWNER")}</span><strong>{active.tags[0]}</strong><span>{t("MODEL ID")}</span><code>{active.name}</code></div><div className="mh-detail-info"><ShieldCheck size={16}/> {t("Requests are routed through AEVOTRON. Provider billing applies.")}</div><button className="mh-button mh-button-primary full" onClick={()=>setSection("Quickstart")}>{t("Use in API request")} <ArrowUpRight size={15}/></button></> : <div className="mh-catalog-empty"><div className="mh-catalog-empty-icon"><Boxes size={20}/></div><strong>{t("Select a model")}</strong><p>{t("Choose a model card to inspect its provider, model family, and API identifier.")}</p></div>}</div><div className="mh-panel mh-catalog-side-note"><div className="mh-catalog-side-note-icon"><ShieldCheck size={17}/></div><strong>{t("One API. Your provider accounts.")}</strong><p>{t("AEVOTRON routes requests to the selected provider. Model access and charges are controlled by that provider account.")}</p><button className="mh-text-link" onClick={()=>setSection("Quickstart")}>{t("Read the quickstart")} <ArrowUpRight size={13}/></button></div></aside></div></>}{section === "Providers" && <ProviderConnections/>}
          {section === "API keys" && <ApiKeyManager/>}
          {section === "Usage & logs" && <UsageDashboard/>}
          {(section === "Quickstart" || section === "API reference") && <>
            <div className="mh-page-heading"><div><div className="mh-eyebrow">{t("DEVELOPERS")}</div><h1>{section === "Quickstart" ? t("Quickstart") : t("API reference")}</h1><p>{section === "Quickstart" ? t("Make your first request in three steps.") : t("Endpoint details, authentication, request format and supported features.")}</p></div></div>
            {section === "Quickstart" ? <div className="mh-docs-layout">
              <div className="mh-panel mh-docs">
                <div className="mh-docs-title"><span className="mh-doc-step">01</span><h3>{t("Connect a provider")}</h3></div>
                <p>{t("Connect your OpenAI account in Providers. Your provider credential is encrypted and stays on the server.")}</p>
                <button className="mh-button mh-button-quiet" onClick={() => setSection("Providers")}>{t("Open providers")} <ArrowUpRight size={14}/></button>
              </div>
              <div className="mh-panel mh-docs">
                <div className="mh-docs-title"><span className="mh-doc-step">02</span><h3>{t("Create an API key")}</h3></div>
                <p>{t("Create a workspace API key. Copy it when it is shown — the full secret is displayed only once.")}</p>
                <button className="mh-button mh-button-quiet" onClick={() => setSection("API keys")}>{t("Manage API keys")} <ArrowUpRight size={14}/></button>
              </div>
              <div className="mh-panel mh-docs">
                <div className="mh-docs-title"><span className="mh-doc-step">03</span><h3>{t("Send your first request")}</h3><span className="mh-method">POST</span></div>
                <p>{t("Send a chat completion request to the endpoint below. Replace the sample API key with your own key.")}</p>
                <div className="mh-endpoint">{apiEndpoint}</div>
                <pre className="mh-code"><code>{code}</code></pre>
                <button className="mh-copy-button" onClick={copyCode}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? t("Copied") : t("Copy cURL")}</button>
                <div className="mh-doc-warning"><CircleHelp size={15}/>{t("This preview supports OpenAI text chat only. Streaming, tool calls, embeddings and multimodal requests are not available yet.")}</div>
              </div>
            </div> : <div className="mh-api-docs">
              <section className="mh-api-hero">
                <div className="mh-api-hero-top"><span className="mh-api-kicker"><Code2 size={14}/> {t("API reference")}</span><span className="mh-api-version">v1 · PREVIEW</span></div>
                <div className="mh-api-hero-main"><div><h2>{t("Chat completions")}</h2><p>{t("A single, OpenAI-compatible endpoint for text chat requests.")}</p></div><span className="mh-api-method">POST</span></div>
                <div className="mh-api-url"><span>{apiEndpoint}</span><button type="button" aria-label={t("Copy cURL")} onClick={async()=>{try{await navigator.clipboard.writeText(apiEndpoint);toast.success(t("Copied"));}catch{toast.error(t("Clipboard access is unavailable. Select and copy the key manually."));}}}><Copy size={15}/></button></div>
              </section>
              <div className="mh-api-doc-grid">
                <section className="mh-panel mh-api-card">
                  <div className="mh-api-card-heading"><span className="mh-api-icon"><LockKeyhole size={17}/></span><div><h3>{t("Authentication")}</h3><p>{t("Send your workspace key with every request.")}</p></div></div>
                  <div className="mh-api-code-line"><code>Authorization: Bearer YOUR_AEVOTRON_KEY</code></div>
                  <div className="mh-api-meta-row"><span>{t("Content type")}</span><code>application/json</code></div>
                </section>
                <section className="mh-panel mh-api-card">
                  <div className="mh-api-card-heading"><span className="mh-api-icon"><SlidersHorizontal size={17}/></span><div><h3>{t("Request body")}</h3><p>{t("Required fields for a chat completion.")}</p></div></div>
                  <div className="mh-api-params-wrap"><table className="mh-api-params"><thead><tr><th>{t("Parameter")}</th><th>{t("Type")}</th><th>{t("Description")}</th></tr></thead><tbody>
                    <tr><td><code>model</code></td><td><span className="mh-api-type">string</span></td><td>{t("Model identifier available to your connected provider.")}</td></tr>
                    <tr><td><code>messages</code></td><td><span className="mh-api-type">array</span></td><td>{t("Conversation messages with role and content fields.")}</td></tr>
                  </tbody></table></div>
                </section>
              </div>
              <section className="mh-panel mh-api-example">
                <div className="mh-api-section-head"><div><span className="mh-api-overline">{t("EXAMPLE REQUEST")}</span><h3>{t("Make your first API call")}</h3></div><span className="mh-api-language">cURL</span></div>
                <pre className="mh-code"><code>{code}</code></pre>
                <button className="mh-copy-button" onClick={copyCode}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? t("Copied") : t("Copy cURL")}</button>
              </section>
              <div className="mh-api-doc-grid mh-api-bottom-grid">
                <section className="mh-panel mh-api-card">
                  <div className="mh-api-card-heading"><span className="mh-api-icon success"><Check size={17}/></span><div><h3>{t("Response")}</h3><p>{t("What a successful request returns.")}</p></div></div>
                  <p>{t("On success, the endpoint returns a standard OpenAI-compatible chat completion JSON response, including the response ID, model, choices and usage when supplied by the provider.")}</p>
                  <div className="mh-api-response-chips"><code>id</code><code>model</code><code>choices</code><code>usage</code></div>
                </section>
                <section className="mh-panel mh-api-card">
                  <div className="mh-api-card-heading"><span className="mh-api-icon warning"><CircleHelp size={17}/></span><div><h3>{t("Errors and limits")}</h3><p>{t("Rate limits and error handling.")}</p></div></div>
                  <p>{t("Errors use a JSON error object with a code and message. Requests are limited to 30 per minute per API key. A rate-limited request returns HTTP 429.")}</p>
                  <div className="mh-api-limit"><strong>429</strong><span>HTTP · Too Many Requests</span><small>30 requests / min / API key</small></div>
                </section>
              </div>
              <div className="mh-doc-warning"><CircleHelp size={15}/>{t("Current scope: text chat only. Streaming, tool calls, embeddings and multimodal requests are not supported in this preview.")}</div>
            </div>}
          </>}
          {section === "Preferences" && <WorkspaceSettings preview={preview} account={accountQuery.data}/>}
          {section === "Billing" && <MockBilling/>}
          {section === "Team & projects" && <MockTeam/>}
          {section === "Notifications" && <MockNotifications/>}
        </div>
        <footer className="mh-footer"><span>© 2026 AEVOTRON</span><span><span className="mh-footer-dot"/> {t("All systems operational")} <span className="mh-footer-sep">·</span> {t("Built for developers")}</span><span>v0.1.0-preview</span></footer>
      </main>
    </div>
  );
}
function ProviderConnections() {
  const { language: currentLanguage } = useLanguage();
  const { t } = useTranslation(["dashboard", "translation"]);
  const query = useQuery({
    queryKey: ["provider-connections"],
    queryFn: () => invokeFunction("provider-connections", { action: "list" }),
    retry: 1,
  });
  const connected = query.data?.connections || [];
  const supported = [
    { code: "groq", name: "Groq", detail: "Fast open models and Llama inference", color: "orange", keyLabel: "Groq API key", placeholder: "Paste your Groq API key" },
    { code: "openai", name: "OpenAI", detail: "GPT models and OpenAI-compatible chat completions", color: "green", keyLabel: "OpenAI API key", placeholder: "Paste your OpenAI API key" },
  ];
  return (
    <>
      <div className="mh-page-heading">
        <div><div className="mh-eyebrow">{t("INTEGRATIONS")}</div><h1>{t("Provider connections")}</h1>
          <p>{t("Connect your own provider accounts. Credentials stay encrypted on the server.")}</p></div>
      </div>
      <div className="mh-callout">
        <LockKeyhole size={18}/>
        <div><strong>{t("Bring Your Own Key (BYOK)")}</strong>
          <p>{t("Your key is sent directly to the secure backend over HTTPS, validated with the provider and encrypted before it is stored. It is never returned to this page.")}</p>
        </div>
      </div>
      {query.isError && <div className="mh-inline-error" role="alert">{t("Could not load provider connections. Refresh the page and try again.")}</div>}
      {supported.map((provider) => (
        <ProviderConnectionCard key={provider.code} provider={provider}
          connection={connected.find((item) => item.provider_code === provider.code)}
          currentLanguage={currentLanguage} t={t}/>
      ))}
      <div className="mh-provider-grid mh-provider-grid-muted">
        {providers.filter((provider) => !["OpenAI", "Groq"].includes(provider.name)).map((provider) => (
          <div className="mh-provider-card" key={provider.name}>
            <div className={"mh-provider-logo " + provider.color}>{provider.letter}</div>
            <div className="mh-provider-info"><strong>{provider.name}</strong><small>{t(provider.detail)}</small></div>
            <span className="mh-status planned">{t("Not available yet")}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ProviderConnectionCard({ provider, connection, currentLanguage, t }) {
  const queryClient = useQueryClient();
  const [credential, setCredential] = useState("");
  const [error, setError] = useState("");
  const connect = useMutation({
    mutationFn: (secret) => invokeFunction("provider-connections", {
      action: "connect", provider_code: provider.code, credential: secret,
    }),
    onSuccess: () => {
      setCredential("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["provider-connections"] });
      queryClient.invalidateQueries({ queryKey: ["provider-models"] });
    },
    onError: (err) => setError(err?.message || t("Could not connect this provider. Check the key and try again.")),
  });
  const test = useMutation({
    mutationFn: () => invokeFunction("provider-connections", { action: "test", provider_code: provider.code }),
    onSuccess: () => { setError(""); queryClient.invalidateQueries({ queryKey: ["provider-connections"] }); },
    onError: (err) => setError(err?.message || t("The connection test failed.")),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["provider-connections"] }),
  });
  const revoke = useMutation({
    mutationFn: () => invokeFunction("provider-connections", { action: "revoke", provider_code: provider.code }),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["provider-connections"] });
      queryClient.invalidateQueries({ queryKey: ["provider-models"] });
    },
    onError: (err) => setError(err?.message || t("Could not revoke this provider connection.")),
  });
  const busy = connect.isPending || test.isPending || revoke.isPending;
  const active = connection && ["active", "error"].includes(connection.status);
  const submit = (event) => {
    event.preventDefault();
    const secret = credential.trim();
    if (!secret || busy) return;
    setError("");
    connect.mutate(secret);
  };
  const confirmRevoke = () => {
    const message = provider.code === "openai"
      ? t("Revoke the OpenAI provider connection? Requests using it will stop working.")
      : t("Revoke the Groq provider connection? Requests using it will stop working.");
    if (!window.confirm(message)) return;
    setError("");
    revoke.mutate();
  };
  return (
    <div className="mh-panel mh-connection-panel">
      <div className="mh-panel-heading">
        <div><h3>{provider.name}</h3><p>{t(provider.detail)}</p></div>
        {connect.isPending || test.isPending ? <span className="mh-status planned">{t("Loading")}</span> :
          <span className={"mh-status " + (connection?.status === "active" ? "byok" : "planned")}>
            {connection?.status === "active" ? t("Connected") : connection?.status === "error" ? t("Connection error") : t("Not connected")}
          </span>}
      </div>
      {active ? (
        <div className="mh-connected-row">
          <div><strong>{t("API credential protected")}</strong><small>{connection.last_tested_at ? t("Last checked: {{date}}", { date: formatDate(connection.last_tested_at, currentLanguage, { dateStyle: "medium", timeStyle: "short" }) }) : t("Not checked")}</small></div>
          <div className="mh-connection-actions">
            <button className="mh-button mh-button-quiet" disabled={busy} onClick={() => {setError("");test.mutate();}}>
              {test.isPending ? t("Testing…") : connection.status === "error" ? t("Retry test") : t("Test connection")}
            </button>
            <button className="mh-button mh-button-danger" disabled={busy} onClick={confirmRevoke}>{t("Revoke")}</button>
          </div>
        </div>
      ) : (
        <form className="mh-provider-form" onSubmit={submit}>
          <label className="mh-field-label" htmlFor={provider.code + "-provider-key"}>{t(provider.keyLabel)}</label>
          <input id={provider.code + "-provider-key"} className="mh-field" type="password" value={credential}
            onChange={(event) => setCredential(event.target.value)} autoComplete="off" spellCheck={false}
            placeholder={t(provider.placeholder)} maxLength={500} required
            aria-describedby={provider.code === "openai" ? "openai-key-help" : provider.code + "-key-help"} />
          <div className="mh-field-help" id={provider.code === "openai" ? "openai-key-help" : provider.code + "-key-help"}><LockKeyhole size={14}/> {t("Never paste this key into support chats or public repositories.")}</div>
          <div className="mh-provider-form-actions">
            <button className="mh-button mh-button-primary" type="submit" disabled={!credential.trim() || busy}>
              {connect.isPending ? t("Validating and encrypting…") : t("Connect {{provider}}", { provider: provider.name })}
            </button>
          </div>
        </form>
      )}
      {error && <div className="mh-inline-error" role="alert">{t(error)}</div>}
      {connect.isSuccess && <div className="mh-inline-success">{t("{{provider}} is connected. Your credential is encrypted and hidden.", { provider: provider.name })}</div>}
      {revoke.isSuccess && <div className="mh-inline-success">{t("The provider credential has been revoked.")}</div>}
    </div>
  );
}

function ApiKeyManager() {
  const { language: currentLanguage } = useLanguage();
  const { t } = useTranslation(["dashboard", "translation"]);
  const queryClient = useQueryClient();
  const [name, setName] = useState("My application");
  const [expiry, setExpiry] = useState("90");
  const [revealedKey, setRevealedKey] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const query = useQuery({
    queryKey: ["aevotron-api-keys"],
    queryFn: () => invokeFunction("api-keys", { action: "list" }),
    retry: 1,
  });
  const create = useMutation({
    mutationFn: () => invokeFunction("api-keys", {
      action: "create", name: name.trim(), expires_in_days: Number(expiry),
    }),
    onSuccess: (result) => {
      setRevealedKey(result.key);
      setCopied(false);
      setName("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["aevotron-api-keys"] });
    },
    onError: (err) => setError(err?.message || t("Could not create the API key.")),
  });
  const revoke = useMutation({
    mutationFn: (keyId) => invokeFunction("api-keys", { action: "revoke", key_id: keyId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["aevotron-api-keys"] }),
    onError: (err) => setError(err?.message || t("Could not revoke the API key.")),
  });
  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
    } catch {
      setError(t("Clipboard access is unavailable. Select and copy the key manually."));
    }
  };

  return (
    <>
      <div className="mh-page-heading">
        <div><div className="mh-eyebrow">{t("ACCESS CONTROL")}</div><h1>{t("API keys")}</h1>
          <p>{t("Create and revoke credentials for your applications.")}</p></div>
      </div>
      {revealedKey && <div className="mh-panel mh-secret-reveal" role="status">
        <div className="mh-secret-heading"><ShieldCheck size={18}/><strong>{t("Your new API key")}</strong></div>
        <p>{t("This key is shown only once. Copy it now and store it in your password manager.")}</p>
        <div className="mh-secret-value"><code>{revealedKey}</code></div>
        <div className="mh-secret-actions">
          <button className="mh-button mh-button-primary" onClick={copyKey}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? t("Copied") : t("Copy key")}</button>
          <button className="mh-button mh-button-quiet" onClick={() => setRevealedKey("")}>{t("I saved it")}</button>
        </div>
      </div>}
      <div className="mh-panel mh-key-create">
        <div className="mh-panel-heading"><div><h3>{t("Create an API key")}</h3><p>{t("The full value is generated once. Only its HMAC hash is stored.")}</p></div></div>
        <form className="mh-key-form" onSubmit={(event) => {event.preventDefault();setError("");create.mutate();}}>
          <div className="mh-key-form-name"><label className="mh-field-label" htmlFor="api-key-name">{t("Key name")}</label>
            <input id="api-key-name" className="mh-field" value={name} onChange={(event) => setName(event.target.value)}
              maxLength={60} minLength={1} required autoComplete="off" placeholder={t("My application")} /></div>
          <div className="mh-key-form-expiry"><label className="mh-field-label" htmlFor="api-key-expiry-trigger">{t("Expires in")}</label>
            <Dropdown id="api-key-expiry" aria-label={t("Expires in")} value={expiry} onChange={setExpiry} options={[{value:"30",label:t("30 days")},{value:"90",label:t("90 days")},{value:"365",label:t("1 year")}]}/></div>
          <button className="mh-button mh-button-primary" type="submit" disabled={!name.trim() || create.isPending}>
            {create.isPending ? t("Creating…") : <><Plus size={15}/> {t("Create key")}</>}
          </button>
        </form>
        {error && <div className="mh-inline-error" role="alert">{t(error)}</div>}
      </div>
      <div className="mh-panel mh-key-list-panel">
        <div className="mh-panel-heading"><div><h3>{t("Existing keys")}</h3><p>{t("Revoke a key immediately if it is no longer needed.")}</p></div>
          <span className="mh-step-count">{t("{{count}} total", { count: query.data?.keys?.length ?? 0 })}</span></div>
        {query.isLoading ? <div className="mh-empty">{t("Loading API keys…")}</div> :
          query.isError ? <div className="mh-inline-error">{t("Could not load API keys. Refresh the page and try again.")}</div> :
          !query.data?.keys?.length ? <div className="mh-empty">{t("No API keys have been created yet.")}</div> :
          <div className="mh-key-list">{query.data.keys.map((key) => (
            <div className="mh-key-row" key={key.id}>
              <div className="mh-key-main"><strong>{key.name}</strong><code>{key.key_prefix}••••••••••</code>
                <small>{t("Created")} {key.created_date ? formatDate(key.created_date, currentLanguage) : t("recently")} · {t("Expires")} {key.expires_at ? formatDate(key.expires_at, currentLanguage) : t("Never")}</small></div>
              <div className="mh-key-actions"><span className={`mh-status ${key.status === "active" ? "byok" : "planned"}`}>{t(key.status)}</span>
                {["active", "expired"].includes(key.status) && <button className="mh-button mh-button-danger" disabled={revoke.isPending} onClick={() => {if (!window.confirm(t("Revoke this API key? Applications using it will lose access immediately."))) return;setError("");revoke.mutate(key.id);}}>{t("Revoke")}</button>}</div>
            </div>
          ))}</div>}
      </div>
    </>
  );
}

function UsageDashboard() {
  const { language: currentLanguage } = useLanguage();
  const { t } = useTranslation(["dashboard", "translation"]);
  const query = useQuery({
    queryKey: ["usage-events"],
    queryFn: () => invokeFunction("usage", { action: "events" }),
    staleTime: 30_000,
    retry: 1,
  });
  const summary = query.data?.summary;
  const events = query.data?.events || [];
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const filteredEvents = useMemo(() => events.filter((event) => {
    const text = `${event.model_id || ""} ${event.provider_code || ""} ${event.error_code || ""}`.toLowerCase();
    const matchesStatus = statusFilter === "all" || (statusFilter === "success" ? event.status_code < 400 : event.status_code >= 400);
    return text.includes(searchText.toLowerCase()) && matchesStatus;
  }), [events, searchText, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / 10));
  const visibleEvents = filteredEvents.slice((page - 1) * 10, page * 10);

  return (
    <>
      <div className="mh-page-heading">
        <div><div className="mh-eyebrow">{t("OBSERVABILITY")}</div><h1>{t("Usage & logs")}</h1>
          <p>{t("Recent gateway activity, token counts, latency and provider errors. Prompts and responses are not stored.")}</p></div>
      </div>
      <div className="mh-stats">
        <Stat icon={Activity} label={t("Requests")} value={summary?.requests ?? "—"} note={t("Last 30 days")}/>
        <Stat icon={Cpu} label={t("Tokens")} value={summary?.tokens ?? "—"} note={t("Input + output")}/>
        <Stat icon={Zap} label={t("Avg. latency")} value={summary?.average_latency_ms ? `${summary.average_latency_ms} ms` : "—"} note={t("Successful and failed calls")}/>
        <Stat icon={ShieldCheck} label={t("Error rate")} value={summary ? `${summary.error_rate}%` : "—"} note={t("Last 30 days")}/>
      </div>
      <div className="mh-panel mh-usage-panel">
        <div className="mh-panel-heading"><div><h3>{t("Recent requests")}</h3><p>{t("Metadata only · latest 50 events")}</p></div>
          <span className="mh-step-count">{t("{{count}} matching events", { count: filteredEvents.length })}</span></div>
        <div className="mh-toolbar av-logs-toolbar"><div className="mh-search"><Search size={16}/><input aria-label={t("Search request logs")} value={searchText} onChange={event=>{setSearchText(event.target.value);setPage(1);}} placeholder={t("Search model, provider or error")}/></div><Dropdown aria-label={t("Filter request status")} value={statusFilter} onChange={value=>{setStatusFilter(value);setPage(1);}} options={[{value:"all",label:t("All statuses")},{value:"success",label:t("Successful")},{value:"error",label:t("Errors")}]}/></div>
        {query.isLoading ? <div className="mh-empty">{t("Loading usage records…")}</div> :
          query.isError ? <div className="mh-inline-error">{t("Could not load usage records. Refresh the page and try again.")}</div> :
          !events.length ? <div className="mh-empty">{t("No gateway requests have been recorded yet.")}</div> :
          <div className="mh-usage-table-wrap"><table className="mh-usage-table">
            <thead><tr><th>{t("TIME")}</th><th>{t("MODEL")}</th><th>{t("TOKENS")}</th><th>{t("LATENCY")}</th><th>{t("STATUS")}</th></tr></thead>
            <tbody>{visibleEvents.map((event) => (
              <tr key={event.id}>
                <td>{event.created_at ? formatDate(event.created_at, currentLanguage, { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
                <td><strong>{event.model_id}</strong><small>{event.provider_code}</small></td>
                <td>{event.input_tokens + event.output_tokens}</td>
                <td>{event.latency_ms ? `${event.latency_ms} ms` : "—"}</td>
                <td><span className={`mh-status ${event.status_code >= 400 ? "planned" : "byok"}`}>{event.status_code || "—"}</span>
                  {event.error_code && <small className="mh-usage-error-code">{event.error_code}</small>}</td>
              </tr>
            ))}</tbody>
          </table><div className="av-pagination"><span>{t("Page {{page}} of {{pageCount}}", { page, pageCount })}</span><div><button className="mh-button mh-button-quiet" disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>{t("Previous")}</button><button className="mh-button mh-button-quiet" disabled={page>=pageCount} onClick={()=>setPage(value=>Math.min(pageCount,value+1))}>{t("Next")}</button></div></div></div>}
      </div>
    </>
  );
}


function MfaSettings({ preview = false }) {
  const { t } = useTranslation(["dashboard", "translation"]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    const result = await api.auth.mfaStatus();
    setEnabled((result.methods || []).includes("totp"));
  };
  useEffect(() => {
    if (preview) {
      setLoading(false);
      return undefined;
    }
    let mounted = true;
    api.auth.mfaStatus()
      .then((result) => { if (mounted) setEnabled((result.methods || []).includes("totp")); })
      .catch((err) => { if (mounted) setError(err.message || t("Could not load MFA status.")); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [preview]);

  if (preview) {
    return <div className="av-mfa-settings">
      <div className="av-settings-heading"><h3>{t("Two-factor authentication")}</h3><p>{t("Protect sign-ins with a time-based code from an authenticator app.")}</p></div>
      <div className="mh-callout av-settings-notice" role="note">{t("Authenticator setup is unavailable in the read-only preview. Sign in to a connected account to manage MFA.")}</div>
    </div>;
  }

  const start = async () => {
    setBusy(true); setError("");
    try {
      const result = await api.auth.mfaEnroll();
      setEnrollment(result);
      setCode("");
    } catch (err) { setError(err.message || t("Could not start authenticator setup.")); }
    finally { setBusy(false); }
  };
  const confirm = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError(t("Enter the 6-digit code from your authenticator app.")); return; }
    setBusy(true); setError("");
    try {
      await api.auth.mfaConfirm(code);
      setEnrollment(null); setCode("");
      await refresh();
      toast.success(t("Two-factor authentication enabled"));
    } catch (err) { setError(err.message || t("Could not verify the authenticator code.")); }
    finally { setBusy(false); }
  };
  const disable = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError(t("Enter the current 6-digit authenticator code.")); return; }
    setBusy(true); setError("");
    try {
      await api.auth.mfaDisable(code);
      setCode(""); setEnrollment(null);
      await refresh();
      toast.success(t("Two-factor authentication disabled"));
    } catch (err) { setError(err.message || t("Could not disable two-factor authentication.")); }
    finally { setBusy(false); }
  };

  return <div className="av-mfa-settings">
    <div className="av-settings-heading"><h3>{t("Two-factor authentication")}</h3><p>{t("Protect sign-ins with a time-based code from an authenticator app.")}</p></div>
    <div className="av-session-row"><div><strong>{loading ? t("Checking account security…") : enabled ? t("Authenticator enabled") : t("Authenticator not enabled")}</strong><small>{enabled ? t("A one-time code is required during sign-in.") : t("Use an authenticator app such as 1Password, Authy or Google Authenticator.")}</small></div><span className={`mh-status ${enabled ? "byok" : "planned"}`}>{loading ? t("Checking") : enabled ? t("Enabled") : t("Disabled")}</span></div>
    {!loading && !enabled && !enrollment && <button className="mh-button mh-button-primary" type="button" disabled={busy} onClick={start}>{busy ? t("Starting…") : t("Set up authenticator")}</button>}
    {enrollment && <form className="av-mfa-enrollment" onSubmit={confirm}>
      <p>{t("Scan this QR code with your authenticator app, then enter the generated 6-digit code to confirm setup.")}</p>
      {enrollment.qr_code && <img className="av-mfa-qr" src={enrollment.qr_code} alt={t("Authenticator setup QR code")}/>}
      <label className="av-setting-field"><span>{t("Manual setup key")}</span><input readOnly value={enrollment.secret_formatted || enrollment.secret || ""}/></label>
      <label className="av-setting-field"><span>{t("Authenticator code")}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/></label>
      <div className="av-modal-actions"><button className="mh-button mh-button-quiet" type="button" disabled={busy} onClick={()=>{setEnrollment(null);setCode("");}}>{t("Cancel")}</button><button className="mh-button mh-button-primary" type="submit" disabled={busy || code.length!==6}>{busy ? t("Verifying…") : t("Confirm and enable")}</button></div>
    </form>}
    {enabled && <form className="av-mfa-enrollment" onSubmit={disable}>
      <label className="av-setting-field"><span>{t("Current authenticator code to disable MFA")}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/></label>
      <button className="mh-button mh-button-danger" type="submit" disabled={busy || code.length!==6}>{busy ? t("Disabling…") : t("Disable two-factor authentication")}</button>
    </form>}
    {error && <div className="mh-inline-error" role="alert">{t(error)}</div>}
  </div>;
}

const SETTINGS_DEFAULTS = {
  timezone: "Europe/Amsterdam", language: "English",
  twoFactor: true, emailSecurity: true, emailUsage: true, pushUsage: false, inAppProduct: true,
  currency: "USD", autoTopUp: false, monthlyLimit: "250", requestLimit: "60", ipWhitelist: "", webhookUrl: "",
  theme: "system", accent: "blue",
};
function readSettings() {
  if (typeof window === "undefined") return SETTINGS_DEFAULTS;
  try { return { ...SETTINGS_DEFAULTS, ...JSON.parse(window.localStorage.getItem("aevotron-workspace-settings") || "{}") }; }
  catch { return SETTINGS_DEFAULTS; }
}
function WorkspaceSettings({ preview = false, account }) {
  const { language: currentLanguage } = useLanguage();
  const { t } = useTranslation(["dashboard", "translation"]);
  const [settings, setSettings] = useState(readSettings);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [tab, setTab] = useState("Profile");
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({
    queryKey: ["auth-sessions"],
    queryFn: () => api.auth.sessions(),
    enabled: !preview && tab === "Security",
    retry: false,
    staleTime: 30_000,
  });
  const passwordMutation = useMutation({
    mutationFn: () => api.auth.changePassword({
      current_password: currentPassword,
      new_password: newPassword,
      mfa_code: mfaCode,
    }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setMfaCode("");
      toast.success(t("Password updated. Other sessions were signed out."));
      queryClient.invalidateQueries({ queryKey: ["auth-sessions"] });
    },
    onError: (error) => toast.error(t(error.message || "Could not update password.")),
  });
  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId) => api.auth.revokeSession(sessionId),
    onSuccess: () => {
      toast.success(t("Session revoked"));
      queryClient.invalidateQueries({ queryKey: ["auth-sessions"] });
    },
    onError: (error) => toast.error(t(error.message || "Could not revoke session.")),
  });
  const [avatar, setAvatar] = useState(() => typeof window !== "undefined" ? window.localStorage.getItem("aevotron-avatar") || "" : "");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const update = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try { window.localStorage.setItem("aevotron-workspace-settings", JSON.stringify(next)); } catch { toast.error(t("Could not persist this setting in local storage")); return; }
    if (key === "theme") setAppTheme(value);
    toast.success(t("Setting saved"));
  };
  const uploadAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) { toast.error(t("Choose an image under 2 MB")); return; }
    const reader = new FileReader();
    reader.onload = () => { const value = String(reader.result); setAvatar(value); try { window.localStorage.setItem("aevotron-avatar", value); } catch { toast.error(t("Image is too large for local storage")); } };
    reader.readAsDataURL(file);
  };
  const tabs = [{name:"Profile",icon:UserRound},{name:"Security",icon:Shield},{name:"Notifications",icon:Bell},{name:"Billing",icon:Wallet},{name:"API",icon:SlidersHorizontal},{name:"Appearance",icon:Palette},{name:"Danger zone",icon:Trash2}];
  const field = (label,key,placeholder="") => <label className="av-setting-field"><span>{t(label)}</span><input type={key === "email" ? "email" : key === "monthlyLimit" || key === "requestLimit" ? "number" : "text"} min={key === "monthlyLimit" || key === "requestLimit" ? "1" : undefined} value={settings[key] ?? ""} placeholder={placeholder ? t(placeholder) : undefined} onChange={e=>update(key,e.target.value)}/></label>;
  const toggle = (label,key,description) => <div className="av-setting-row"><div><strong>{t(label)}</strong><small>{t(description)}</small></div><button type="button" role="switch" aria-checked={!!settings[key]} className={`av-switch ${settings[key] ? "is-on" : ""}`} onClick={()=>update(key,!settings[key])}><span/></button></div>;
  const select = (label,key,options) => <label className="av-setting-field"><span>{t(label)}</span><Dropdown aria-label={t(label)} value={settings[key]} onChange={value=>update(key,value)} options={options.map(option=>({value:option,label:t(option)}))}/></label>;
  return <div className="av-settings">
    <div className="mh-callout av-settings-notice" role="note"><Shield size={16}/><span><strong>{t("Account settings status.")}</strong> {t("Profile identity is read from your account. Password changes, active-session revocation and two-factor authentication use the account API. Appearance, regional preferences and avatar are stored in this browser; billing, notification delivery, webhooks and API restrictions are not yet connected to server-side settings.")}</span></div>
    <div className="mh-page-heading"><div><div className="mh-eyebrow">{t("ACCOUNT")}</div><h1>{t("Settings")}</h1><p>{t("Manage your account, security and workspace defaults.")} {preview ? t("Sample account data is shown in this read-only preview.") : t("Identity details are read from your signed-in account.")}</p></div></div>
    <div className="av-settings-layout">
      <nav className="av-settings-tabs" aria-label={t("Settings sections")}>{tabs.map(item=><button type="button" key={item.name} className={tab===item.name?"active":""} onClick={()=>setTab(item.name)}><item.icon size={16}/>{t(item.name)}</button>)}</nav>
      <section className="mh-panel av-settings-panel">
        {tab==="Profile" && <><div className="av-settings-heading"><h2>{t("Profile")}</h2><p>{t("Your account identity and regional preferences. Name and email are managed by your account service.")}</p></div><div className="av-avatar-editor"><div className="av-avatar-preview">{avatar ? <img src={avatar} alt={t("Profile avatar")}/>  : (account?.display_name?.charAt(0) || account?.email?.charAt(0) || (preview ? "S" : "A")).toUpperCase()}</div><div><strong>{t("Profile photo")}</strong><small>{t("JPG, PNG or WebP · up to 2 MB")}</small><label className="mh-button mh-button-quiet av-upload-button">{t("Upload photo")}<input type="file" accept="image/*" onChange={uploadAvatar}/></label></div></div><div className="av-settings-grid"><label className="av-setting-field"><span>{t("Full name")}</span><input readOnly value={account?.display_name || account?.email?.split("@")[0] || (preview ? t("Sample account") : t("Loading account…"))}/></label><label className="av-setting-field"><span>{t("Email address")}</span><input readOnly value={account?.email || (preview ? t("Read-only preview") : t("Loading account…"))}/></label>{select("Time zone","timezone",["Europe/Amsterdam","Europe/London","Europe/Berlin","Europe/Moscow","America/New_York","Asia/Tokyo","UTC"])}{select("Language","language",["English","Русский","简体中文"])}</div></>}
        {tab==="Security" && <><div className="av-settings-heading"><h2>{t("Security")}</h2><p>{t("Protect your account and review active access.")}</p></div><MfaSettings preview={preview}/><div className="av-settings-subtitle">{t("Change password")}</div>{preview ? <div className="mh-callout av-settings-notice" role="note">{t("Password changes are disabled in the read-only preview.")}</div> : <form className="av-settings-grid" onSubmit={event=>{event.preventDefault();if(newPassword===currentPassword){toast.error(t("Choose a new password different from the current one."));return;}passwordMutation.mutate();}}><label className="av-setting-field"><span>{t("Current password")}</span><input type="password" required minLength={12} maxLength={256} autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/></label><label className="av-setting-field"><span>{t("New password")}</span><input type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)}/></label><label className="av-setting-field"><span>{t("Authenticator code (if MFA is enabled)")}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={mfaCode} onChange={event=>setMfaCode(event.target.value.replace(/\\D/g,"").slice(0,6))} placeholder="000000"/></label><button className="mh-button mh-button-primary" type="submit" disabled={passwordMutation.isPending || currentPassword.length<12 || newPassword.length<12}>{passwordMutation.isPending?t("Updating…"):t("Update password")}</button></form>}<div className="av-settings-subtitle">{t("Active sessions")}</div>{preview ? <div className="mh-callout av-settings-notice" role="note">{t("Session data is not included in the read-only preview.")}</div> : sessionsQuery.isLoading ? <div className="mh-empty">{t("Loading active sessions…")}</div> : sessionsQuery.isError ? <div className="mh-inline-error" role="alert">{t(sessionsQuery.error?.message || "Could not load active sessions.")}</div> : (sessionsQuery.data?.sessions || []).length === 0 ? <div className="mh-empty">{t("No active sessions found.")}</div> : (sessionsQuery.data.sessions).map(session=><div className="av-session-row" key={session.id}><div><strong>{session.id===sessionsQuery.data.current_session_id?t("This device"):t("Signed-in device")}</strong><small>{session.user_agent || t("Unknown browser")} · {t("Last active")} {formatDate(session.last_seen_at, currentLanguage, { dateStyle: "medium", timeStyle: "short" })}</small><small>{t("Signed in")} {formatDate(session.created_at, currentLanguage, { dateStyle: "medium", timeStyle: "short" })}</small></div>{session.id===sessionsQuery.data.current_session_id?<span className="mh-status byok">{t("Current")}</span>:<button className="mh-button mh-button-danger" type="button" disabled={revokeSessionMutation.isPending} onClick={()=>{if(window.confirm(t("End this session? The device will need to sign in again.")))revokeSessionMutation.mutate(session.id);}}>{t("End session")}</button>}</div>)}</>}
        {tab==="Notifications" && <><div className="av-settings-heading"><h2>{t("Notifications")}</h2><p>{t("Choose which events can reach you.")}</p></div>{toggle("Security alerts","emailSecurity","Important sign-in and account security events by email.")}{toggle("Usage summaries","emailUsage","Periodic usage and spend summaries by email.")}{toggle("Push notifications","pushUsage","Browser notifications for important account events.")}{toggle("In-app product updates","inAppProduct","Service announcements and product changes.")}</>}
        {tab==="Billing" && <><div className="av-settings-heading"><h2>{t("Billing preferences")}</h2><p>{t("Configure spending safeguards. Changes are stored locally in this preview.")}</p></div>{select("Billing currency","currency",["USD","EUR","GBP","RUB"])}{toggle("Automatic top-up","autoTopUp","Automatically add funds when your balance is low (demo).")}{field("Monthly spending limit (USD)","monthlyLimit")}</>}
        {tab==="API" && <><div className="av-settings-heading"><h2>{t("API controls")}</h2><p>{t("Set request limits and trusted destinations.")}</p></div>{field("Requests per minute","requestLimit")}{field("IP allowlist (comma-separated)","ipWhitelist","203.0.113.10, 198.51.100.0/24")}{field("Webhook URL","webhookUrl","https://example.com/webhooks/aevotron")}<button className="mh-button mh-button-quiet av-settings-action" onClick={()=>{if(settings.webhookUrl && !/^https:\/\//i.test(settings.webhookUrl)){toast.error(t("Webhook URL must use HTTPS"));return;}toast.success(t("API controls saved"));}}>{t("Validate and save API controls")}</button></>}
        {tab==="Appearance" && <><div className="av-settings-heading"><h2>{t("Appearance")}</h2><p>{t("Make the workspace comfortable on every device.")}</p></div><div className="av-appearance-options">{[{value:"light",label:"Light",icon:Sun},{value:"dark",label:"Dark",icon:Moon},{value:"system",label:"System",icon:Monitor}].map(option=><button key={option.value} className={settings.theme===option.value?"selected":""} onClick={()=>update("theme",option.value)}><option.icon size={20}/>{t(option.label)}</button>)}</div><div className="av-settings-subtitle">{t("Accent color")}</div><div className="av-accent-options">{["blue","violet","graphite"].map(color=><button key={color} aria-label={t(color+" accent")} className={settings.accent===color?"selected":""} data-accent={color} onClick={()=>update("accent",color)}/>)}</div></>}
        {tab==="Danger zone" && <><div className="av-settings-heading"><h2>{t("Danger zone")}</h2><p>{t("Irreversible actions for your account.")}</p></div><div className="av-danger-card"><div><strong>{t("Delete account")}</strong><small>{t("This demo only clears local preview preferences. It does not contact the production account service.")}</small></div><button className="mh-button mh-button-danger" onClick={()=>setDeleteOpen(true)}>{t("Delete account")}</button></div></>}
      </section>
    </div>
    {deleteOpen && <div className="av-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDeleteOpen(false);}}><div className="av-modal" role="dialog" aria-modal="true" aria-labelledby="av-delete-title"><button className="av-modal-close" aria-label={t("Close")} onClick={()=>setDeleteOpen(false)}><X size={18}/></button><h2 id="av-delete-title">{t("Delete preview data?")}</h2><p>{t("This clears locally saved workspace settings and avatar from this browser. It does not delete a real account.")}</p><label className="av-setting-field"><span>{t("Type DELETE to confirm")}</span><input value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></label><div className="av-modal-actions"><button className="mh-button mh-button-quiet" onClick={()=>setDeleteOpen(false)}>{t("Cancel")}</button><button className="mh-button mh-button-danger" disabled={confirmation!=="DELETE"} onClick={()=>{localStorage.removeItem("aevotron-workspace-settings");localStorage.removeItem("aevotron-avatar");setSettings(SETTINGS_DEFAULTS);setAppTheme(SETTINGS_DEFAULTS.theme);setAvatar("");setConfirmation("");setDeleteOpen(false);toast.success(t("Local preview settings cleared"));}}>{t("Delete local data")}</button></div></div></div>}
  </div>;
}
function MockBilling() {
  const { t } = useTranslation(["dashboard", "translation"]);
  const { language } = useLanguage();
  const currency = (value) => formatCurrency(value, "USD", language);
  const formatBillingDate = (month, day, year = true) => formatDate(
    new Date(Date.UTC(2026, month - 1, day)),
    language,
    { month: "short", day: "2-digit", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" },
  );
  const formatSignedCurrency = (value) => value > 0 ? `+${currency(value)}` : currency(value);
  const [amount,setAmount]=useState("50");
  const [balance,setBalance]=useState(128.4);
  const [period,setPeriod]=useState("30 days");
  return <><div className="mh-page-heading"><div><div className="mh-eyebrow">{t("FINANCE")}</div><h1>{t("Billing")}</h1><p>{t("Track your balance, transactions and provider spend.")}</p></div></div><div className="mh-stats"><Stat icon={Wallet} label={t("Available balance")} value={currency(balance)} note={t("Demo wallet balance")}/><Stat icon={CircleDollarSign} label={t("This month")} value={currency(42.8)} note={t("Estimated provider spend")}/><Stat icon={CreditCard} label={t("Payment method")} value="•••• 4242" note={t("Demo payment method")}/><Stat icon={Activity} label={t("Next invoice")} value={formatBillingDate(12,1,false)} note={t("Estimated billing date")}/></div><div className="mh-panel av-mock-panel av-topup-panel"><div className="mh-panel-heading"><div><h3>{t("Add funds")}</h3><p>{t("Mock top-up. No payment is processed.")}</p></div></div><div className="av-topup-row"><Dropdown aria-label={t("Top-up amount")} value={amount} onChange={setAmount} options={[20,50,100,250].map(value=>({value:String(value),label:currency(value)}))}/><button className="mh-button mh-button-primary" onClick={()=>{setBalance(value=>value+Number(amount));toast.success(t("{{amount}} demo funds added", { amount: currency(Number(amount)) }));}}>{t("Add funds")}</button></div></div><div className="mh-panel av-mock-panel av-transactions-panel"><div className="mh-panel-heading"><div><h3>{t("Transactions")}</h3><p>{t("Recent account activity · demo data")}</p></div><Dropdown aria-label={t("Transaction period")} value={period} onChange={setPeriod} options={["30 days","90 days","12 months"].map(value=>({value,label:t(value)}))}/></div>{[{date:formatBillingDate(11,18),name:"Provider usage",value:-12.4},{date:formatBillingDate(11,12),name:"Account top-up",value:100},{date:formatBillingDate(11,4),name:"Provider usage",value:-30.4}].map((row,index)=><div className="av-session-row" key={index}><div><strong>{t(row.name)}</strong><small>{row.date}</small></div><strong>{formatSignedCurrency(row.value)}</strong></div>)}</div></>;
}
function MockTeam() {
  const { t } = useTranslation(["dashboard", "translation"]);
  const [members,setMembers]=useState([{email:"christopher@example.com",role:"Owner",status:"Active"},{email:"developer@studio.example",role:"Developer",status:"Invited"},{email:"finance@studio.example",role:"Billing",status:"Active"}]);
  const [email,setEmail]=useState("");
  return <><div className="mh-page-heading"><div><div className="mh-eyebrow">{t("COLLABORATION")}</div><h1>{t("Team & projects")}</h1><p>{t("Manage workspace members and access roles.")}</p></div></div><div className="mh-panel av-mock-panel"><div className="mh-panel-heading"><div><h3>{t("Invite a teammate")}</h3><p>{t("Invitations are simulated in this local preview.")}</p></div></div><form className="av-topup-row" onSubmit={e=>{e.preventDefault();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast.error(t("Enter a valid email address"));return;}if(members.some(member=>member.email.toLowerCase()===email.trim().toLowerCase())){toast.error(t("This email is already in the workspace"));return;}setMembers(list=>[...list,{email:email.trim(),role:"Developer",status:"Invited"}]);setEmail("");toast.success(t("Invitation added to demo team"));}}><input type="email" required autoComplete="email" aria-label={t("Teammate email address")} value={email} onChange={e=>setEmail(e.target.value)} placeholder={t("name@company.com")}/><button className="mh-button mh-button-primary" type="submit"><Plus size={15}/> {t("Invite")}</button></form></div><div className="mh-panel av-mock-panel"><div className="mh-panel-heading"><div><h3>{t("Workspace members")}</h3><p>{t("{{count}} members and invitations", { count: members.length })}</p></div></div>{members.map((member,index)=><div className="av-session-row" key={member.email}><div><strong>{member.email}</strong><small>{t(member.status)}</small></div><Dropdown aria-label={t("Member role")} value={member.role} disabled={index===0} onChange={value=>{setMembers(list=>list.map((item,i)=>i===index?{...item,role:value}:item));toast.success(t("Member role updated"));}} options={["Owner","Admin","Developer","Billing","Viewer"].map(value=>({value,label:value === "Billing" ? t("Billing role") : t(value)}))}/></div>)}</div></>;
}
function MockNotifications() {
  const { t } = useTranslation(["dashboard", "translation"]);
  const { language } = useLanguage();
  const formatTime = (value) => formatDate(value, language, {
    dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
  });
  const [items,setItems]=useState([{id:1,title:"Workspace is ready",detail:"Your AEVOTRON workspace has been initialized.",time:"2026-11-21T09:42:00Z",read:false},{id:2,title:"API key created",detail:"A new key was generated for My application.",time:"2026-11-20T16:20:00Z",read:false},{id:3,title:"Usage summary available",detail:"Your monthly usage summary is ready to review.",time:"2026-11-18T12:00:00Z",read:true}]);
  return <><div className="mh-page-heading"><div><div className="mh-eyebrow">{t("ACTIVITY CENTER")}</div><h1>{t("Notifications")}</h1><p>{t("Important updates and account activity.")}</p></div><button className="mh-button mh-button-quiet" onClick={()=>{setItems(list=>list.map(item=>({...item,read:true})));toast.success(t("All notifications marked as read"));}}>{t("Mark all as read")}</button></div><div className="mh-panel av-mock-panel">{items.map(item=><div className={`av-notification-row ${item.read?"is-read":""}`} key={item.id}><span className="av-notification-dot"/><div><strong>{t(item.title)}</strong><p>{t(item.detail)}</p><small>{formatTime(item.time)}</small></div><button className="mh-button mh-button-quiet" onClick={()=>setItems(list=>list.filter(entry=>entry.id!==item.id))}>{t("Dismiss")}</button></div>)}{!items.length&&<div className="mh-empty">{t("You're all caught up.")}</div>}</div></>;
}

function Stat({icon:Icon,label,value,note}) { return <div className="mh-stat"><div className="mh-stat-icon"><Icon size={17}/></div><div className="mh-stat-label">{label}</div><div className="mh-stat-value">{value}</div><div className="mh-stat-note">{note}</div></div>; }
function Step({number,title,desc,action,onClick,icon:Icon,disabled=false}) { const { t } = useTranslation(["dashboard", "translation"]); return <div className="mh-step"><div className="mh-step-number">{number}</div><div className="mh-step-icon"><Icon size={18}/></div><div className="mh-step-copy"><h3>{t(title)}</h3><p>{t(desc)}</p><button className="mh-text-link" onClick={onClick} disabled={disabled}>{t(action)} <ArrowUpRight size={14}/></button></div><div className="mh-step-check"><span/></div></div>; }
function ModelRow({model,onClick,disabled=false}) { const { t } = useTranslation(["dashboard", "translation"]); return <button className="mh-popular-row" onClick={onClick} disabled={disabled}><span className={`mh-provider-dot ${model.color}`}/><span><strong>{model.name}</strong><small>{model.provider}</small><small className="mh-model-description">{t(model.description)}</small></span><span className="mh-popular-price">{t(model.price)}</span><ArrowUpRight size={14}/></button>; }