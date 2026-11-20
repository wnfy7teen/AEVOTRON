import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Activity, ArrowDownUp, ArrowUpRight, BookOpen, Boxes, Check, ChevronDown, CircleHelp, Code2, Command, Copy, Cpu, CreditCard, Globe2, KeyRound, Layers3, LayoutDashboard, LockKeyhole, Menu, Plus, Search, Settings2, ShieldCheck, Terminal, Zap } from "lucide-react";

const invokeFunction = async (name, payload) => {
  const response = await base44.functions.invoke(name, payload);
  return response?.data ?? response;
};

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({ meta: [{ title: "Aevotron — Workspace" }, { name: "description", content: "One API for every AI model." }] }),
  component: HomePage,
});

const providers = [
  { name: "OpenAI", detail: "GPT models, embeddings, audio", color: "green", letter: "O" },
  { name: "Anthropic", detail: "Claude models", color: "orange", letter: "A" },
  { name: "Google AI", detail: "Gemini models", color: "blue", letter: "G" },
  { name: "DeepSeek", detail: "DeepSeek chat models", color: "cyan", letter: "D" },
  { name: "OpenAI-compatible", detail: "Any compatible endpoint", color: "purple", letter: "↗" },
];

function HomePage() {
  const usageQuery = useQuery({
    queryKey: ["usage-summary"],
    queryFn: () => invokeFunction("usage", { action: "summary" }),
    staleTime: 30_000,
    retry: 1,
  });
  const workspaceLabel = usageQuery.data?.workspace?.name ?? (usageQuery.isPending ? "Loading workspace…" : "Workspace unavailable");
  const modelQuery = useQuery({
    queryKey: ["provider-models"],
    queryFn: () => invokeFunction("provider-connections", { action: "models" }),
    staleTime: 300_000,
    retry: 1,
  });
  const models = useMemo(() => (modelQuery.data?.models || []).map((model) => ({
    name: model.id, provider: "OpenAI", type: "Chat", context: "Provider-defined",
    speed: "Provider API", price: "Direct provider billing",
    tags: [model.owned_by || "OpenAI"], color: "green", status: "BYOK",
  })), [modelQuery.data]);
  const [section, setSection] = useState("Overview");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All models");
  const [selected, setSelected] = useState("");
  const [copied, setCopied] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const filtered = useMemo(() => models.filter(m => (filter === "All models" || m.type === filter) && (m.name + m.provider + m.tags.join(" ")).toLowerCase().includes(query.toLowerCase())), [models, filter, query]);
  const active = models.find(m => m.name === selected) || models[0] || null;
  const nav = [{ label: "WORKSPACE", items: [{ name: "Overview", icon: LayoutDashboard }, { name: "Model catalog", icon: Boxes }, { name: "API keys", icon: KeyRound }, { name: "Usage & logs", icon: Activity }] }, { label: "DEVELOPERS", items: [{ name: "Quickstart", icon: Terminal }, { name: "API reference", icon: BookOpen }] }, { label: "SETTINGS", items: [{ name: "Providers", icon: Layers3 }, { name: "Preferences", icon: Settings2 }] }];
  const apiEndpoint = typeof window !== "undefined"
    ? `${window.location.origin}/v1/chat/completions`
    : "https://aevotron.vercel.app/v1/chat/completions";
  const code = `curl ${apiEndpoint} \\\n  -H "Authorization: Bearer YOUR_MODELHUB_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "${active?.name || "gpt-4o-mini"}",\n    "messages": [{"role":"user","content":"Hello!"}]\n  }'`;
  const copyCode = () => { if (typeof navigator !== "undefined") navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return (
    <div className="mh-shell">
      <aside className={`mh-sidebar ${mobileNav ? "mh-sidebar-open" : ""}`}>
        <div className="mh-brand"><div className="mh-brand-mark"><Command size={19}/></div><span>model<span className="mh-brand-accent">hub</span></span><span className="mh-beta">BETA</span></div>
        <div className="mh-workspace"><div className="mh-workspace-icon">C</div><div><strong>{workspaceLabel}</strong><small>{usageQuery.data?.workspace?.region?.toUpperCase() ?? "Personal workspace"}</small></div><ChevronDown size={15}/></div>
        {nav.map(group => <div className="mh-nav-group" key={group.label}><div className="mh-nav-label">{group.label}</div>{group.items.map(item => <button key={item.name} className={`mh-nav-item ${section === item.name ? "active" : ""}`} onClick={() => {setSection(item.name);setMobileNav(false)}}><item.icon size={17}/><span>{item.name}</span>{item.name === "API keys" && <span className="mh-nav-count">0</span>}</button>)}</div>)}
        <div className="mh-sidebar-bottom"><div className="mh-usage-mini"><div className="mh-usage-top"><span>Free plan</span><span>0 / 1,000 req</span></div><div className="mh-progress"><i/></div><small>Bring your own provider keys to get started.</small></div><button className="mh-profile"><div className="mh-avatar">C</div><div><strong>Christopher</strong><small>Personal account</small></div><Settings2 size={16}/></button></div>
      </aside>
      <main className="mh-main">
        <header className="mh-topbar"><button className="mh-mobile-menu" onClick={() => setMobileNav(!mobileNav)}><Menu size={20}/></button><div className="mh-breadcrumb">Workspace <span>/</span> <strong>{section}</strong></div><div className="mh-top-actions"><div className="mh-region"><Globe2 size={14}/> Global <ChevronDown size={13}/></div><button className="mh-icon-button" aria-label="Help"><CircleHelp size={17}/></button><div className="mh-avatar small">C</div></div></header>
        <div className="mh-content">
          {section === "Overview" && <>
            <div className="mh-page-heading"><div><div className="mh-eyebrow"><span className="mh-live-dot"/> AI INFRASTRUCTURE, SIMPLIFIED</div><h1>Your models. One API.</h1><p>Connect OpenAI once. Route text chat requests through a single API.</p></div><button className="mh-button mh-button-primary" onClick={() => setSection("Providers")}><Plus size={16}/> Connect provider</button></div>
            <div className="mh-stats"><Stat icon={Activity} label="Requests (30 days)" value={usageQuery.data?.summary?.requests ?? "—"} note="Recorded by the gateway"/><Stat icon={Cpu} label="Models in catalog" value={modelQuery.isLoading ? "…" : models.length} note={models.length ? "Available to your OpenAI key" : "Connect OpenAI to discover models"}/><Stat icon={Zap} label="Avg. latency" value={usageQuery.data?.summary?.average_latency_ms ? `${usageQuery.data.summary.average_latency_ms} ms` : "—"} note="Last 30 days"/><Stat icon={CreditCard} label="Provider billing" value="Direct" note="Billed by OpenAI"/></div>
            <div className="mh-section-heading"><div><h2>Get started</h2><p>Three steps to your first API call.</p></div><span className="mh-step-count">0 of 3 complete</span></div>
            <div className="mh-steps"><Step number="01" title="Connect a provider" desc="Add your own API key. It stays private and is never shown in the browser again." action="Add provider" onClick={() => setSection("Providers")} icon={KeyRound}/><Step number="02" title="Create a ModelHub key" desc="Generate a single key for your apps and services to authenticate requests." action="Create API key" onClick={() => setSection("API keys")} icon={LockKeyhole}/><Step number="03" title="Make your first request" desc="Use our OpenAI-compatible endpoint with any supported model." action="View quickstart" onClick={() => setSection("Quickstart")} icon={Code2}/></div>
            <div className="mh-bottom-grid"><div className="mh-panel"><div className="mh-panel-heading"><div><h3>Popular models</h3><p>Start exploring the catalog</p></div><button className="mh-text-link" onClick={() => setSection("Model catalog")}>View all <ArrowUpRight size={14}/></button></div>{models.slice(0,4).map(m => <ModelRow key={m.name} model={m} onClick={() => {setSelected(m.name);setSection("Model catalog")}}/>)}{models.length === 0 && <div className="mh-empty">{modelQuery.isLoading ? "Loading models from OpenAI…" : "Connect OpenAI to load the models available to your account."}</div>}</div><div className="mh-panel mh-code-panel"><div className="mh-panel-heading"><div><h3>Quick API example</h3><p>OpenAI-compatible interface</p></div><span className="mh-code-language">cURL</span></div><pre className="mh-code"><code>{code}</code></pre><button className="mh-copy-button" onClick={copyCode}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copied" : "Copy example"}</button></div></div>
            <div className="mh-trust-note"><ShieldCheck size={17}/><span><strong>Your keys, your control.</strong> Provider credentials are sent over HTTPS, encrypted before storage and never shown again.</span></div>
          </>}
          {section === "Model catalog" && <><div className="mh-page-heading"><div><div className="mh-eyebrow">DISCOVER</div><h1>Model catalog</h1><p>Live chat models available to your connected OpenAI account.</p></div></div><div className="mh-toolbar"><div className="mh-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search models..."/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All models</option><option>Chat</option></select><button className="mh-button mh-button-quiet" onClick={() => modelQuery.refetch()} disabled={modelQuery.isFetching}><ArrowDownUp size={15}/> {modelQuery.isFetching ? "Refreshing…" : "Refresh"}</button></div><div className="mh-catalog-layout"><div className="mh-panel mh-model-list"><div className="mh-list-header"><span>MODEL</span><span>CONTEXT</span><span>ACCESS</span></div>{filtered.map(m=><button key={m.name} className={`mh-model-row ${selected===m.name?"selected":""}`} onClick={()=>setSelected(m.name)}><span className={`mh-provider-dot ${m.color}`}/><span className="mh-model-name"><strong>{m.name}</strong><small>{m.provider}</small></span><span className="mh-model-context">{m.context}</span><span className="mh-status byok">BYOK</span></button>)}{modelQuery.isLoading && <div className="mh-empty">Loading models from OpenAI…</div>}{modelQuery.isError && <div className="mh-inline-error">Could not load models from OpenAI. Test your provider connection and refresh.</div>}{!modelQuery.isLoading && !modelQuery.isError && models.length===0 && <div className="mh-empty">Connect OpenAI to load the chat models available to your API key.</div>}{models.length>0 && filtered.length===0 && <div className="mh-empty">No models match your search.</div>}</div><div className="mh-panel mh-model-detail">{active ? <><div className="mh-detail-top"><span className="mh-provider-dot large green"/><span className="mh-status byok">BYOK</span></div><h2>{active.name}</h2><p>{active.provider} · {active.type} model</p><div className="mh-detail-stats"><div><small>Context window</small><strong>{active.context}</strong></div><div><small>Availability</small><strong>From provider</strong></div><div><small>Pricing</small><strong>{active.price}</strong></div></div><div className="mh-tags">{active.tags.map(t=><span key={t}>{t}</span>)}</div><div className="mh-detail-info"><ShieldCheck size={16}/> Available through your connected OpenAI account. Provider billing applies.</div><button className="mh-button mh-button-primary full" onClick={()=>setSection("Quickstart")}>View API example <ArrowUpRight size={15}/></button></> : <div className="mh-empty">Connect OpenAI to discover the models available to your account.</div>}</div></div></>}{section === "Providers" && <ProviderConnections/>}
          {section === "API keys" && <ApiKeyManager/>}
          {section === "Usage & logs" && <UsageDashboard/>}
          {(section === "Quickstart" || section === "API reference") && <><div className="mh-page-heading"><div><div className="mh-eyebrow">DEVELOPERS</div><h1>{section === "Quickstart" ? "Quickstart" : "API reference"}</h1><p>One endpoint and a familiar request format to get started.</p></div></div><div className="mh-panel mh-docs"><div className="mh-docs-title"><Terminal size={18}/><h3>Chat completions</h3><span className="mh-method">POST</span></div><div className="mh-endpoint">{apiEndpoint}</div><p>OpenAI Chat Completions in a familiar format. Your provider key is used server-side and billing remains with OpenAI. The Base44 backend host must be published before this endpoint becomes reachable.</p><pre className="mh-code"><code>{code}</code></pre><button className="mh-copy-button" onClick={copyCode}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?"Copied":"Copy cURL"}</button><div className="mh-doc-warning"><CircleHelp size={15}/> Beta: OpenAI text chat only; no streaming, tool calls, embeddings or multimodal requests. Limit: 30 requests/minute per key (best-effort, not atomic).</div></div></>}
          {section === "Preferences" && <div className="mh-page-heading"><div><div className="mh-eyebrow">WORKSPACE</div><h1>Preferences</h1><p>Workspace settings and regional defaults will be available here.</p></div></div>}
        </div>
        <footer className="mh-footer"><span>© 2026 ModelHub</span><span><span className="mh-footer-dot"/> All systems operational <span className="mh-footer-sep">·</span> Built for developers</span><span>v0.1.0-preview</span></footer>
      </main>
    </div>
  );
}
function ProviderConnections() {
  const queryClient = useQueryClient();
  const [credential, setCredential] = useState("");
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["provider-connections"],
    queryFn: () => invokeFunction("provider-connections", { action: "list" }),
    retry: 1,
  });
  const connect = useMutation({
    mutationFn: (secret) => invokeFunction("provider-connections", {
      action: "connect", provider_code: "openai", credential: secret,
    }),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["provider-connections"] });
    },
    onError: (err) => setError(err?.message || "Could not connect this provider. Check the key and try again."),
  });
  const test = useMutation({
    mutationFn: (connectionId) => invokeFunction("provider-connections", {
      action: "test", connection_id: connectionId,
    }),
    onSuccess: () => setError(""),
    onError: (err) => setError(err?.message || "The connection test failed."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["provider-connections"] }),
  });
  const revoke = useMutation({
    mutationFn: (connectionId) => invokeFunction("provider-connections", {
      action: "revoke", connection_id: connectionId,
    }),
    onSuccess: () => { setError(""); queryClient.invalidateQueries({ queryKey: ["provider-connections"] }); },
    onError: (err) => setError(err?.message || "Could not revoke this connection."),
  });
  const openai = query.data?.connections?.find((item) => item.provider_code === "openai");
  const busy = connect.isPending || test.isPending || revoke.isPending;

  const submit = (event) => {
    event.preventDefault();
    const secret = credential.trim();
    if (!secret || busy) return;
    setCredential("");
    setError("");
    connect.mutate(secret);
  };

  return (
    <>
      <div className="mh-page-heading">
        <div><div className="mh-eyebrow">INTEGRATIONS</div><h1>Provider connections</h1>
          <p>Connect your own provider accounts. Credentials stay encrypted on the server.</p></div>
      </div>
      <div className="mh-callout">
        <LockKeyhole size={18}/>
        <div><strong>Bring Your Own Key (BYOK)</strong>
          <p>Your key is sent directly to the secure backend over HTTPS, validated with the provider and encrypted before it is stored. It is never returned to this page.</p>
        </div>
      </div>
      <div className="mh-panel mh-connection-panel">
        <div className="mh-panel-heading">
          <div><h3>OpenAI</h3><p>GPT models and OpenAI-compatible chat completions</p></div>
          {query.isLoading ? <span className="mh-status planned">Loading</span> :
            <span className={`mh-status ${openai?.status === "active" ? "byok" : "planned"}`}>
              {openai?.status === "active" ? "Connected" : openai?.status === "error" ? "Connection error" : "Not connected"}
            </span>}
        </div>
        {query.isError && <div className="mh-inline-error">Could not load provider connections. Refresh the page and try again.</div>}
        {openai && ["active", "error"].includes(openai.status) ? (
          <div className="mh-connected-row">
            <div><strong>API credential protected</strong><small>Last checked: {openai.last_tested_at ? new Date(openai.last_tested_at).toLocaleString() : "Not checked"}</small></div>
            <div className="mh-connection-actions">
              <button className="mh-button mh-button-quiet" disabled={busy} onClick={() => {setError("");test.mutate(openai.id);}}> {test.isPending ? "Testing…" : openai.status === "error" ? "Retry test" : "Test connection"} </button>
              <button className="mh-button mh-button-danger" disabled={busy} onClick={() => {setError("");revoke.mutate(openai.id);}}>Revoke</button>
            </div>
          </div>
        ) : (
          <form className="mh-provider-form" onSubmit={submit}>
            <label className="mh-field-label" htmlFor="openai-provider-key">OpenAI API key</label>
            <input id="openai-provider-key" className="mh-field" type="password" value={credential}
              onChange={(event) => setCredential(event.target.value)} autoComplete="off" spellCheck={false}
              placeholder="Paste your OpenAI API key" maxLength={500} />
            <div className="mh-field-help"><LockKeyhole size={14}/> Never paste this key into support chats or public repositories.</div>
            <div className="mh-provider-form-actions">
              <button className="mh-button mh-button-primary" type="submit" disabled={!credential.trim() || busy}>
                {connect.isPending ? "Validating and encrypting…" : "Connect OpenAI"}
              </button>
            </div>
          </form>
        )}
        {error && <div className="mh-inline-error" role="alert">{error}</div>}
        {connect.isSuccess && <div className="mh-inline-success">OpenAI is connected. Your credential is encrypted and hidden.</div>}
        {revoke.isSuccess && <div className="mh-inline-success">The provider credential has been revoked.</div>}
      </div>
      <div className="mh-provider-grid mh-provider-grid-muted">
        {providers.filter((provider) => provider.name !== "OpenAI").map((provider) => (
          <div className="mh-provider-card" key={provider.name}>
            <div className={`mh-provider-logo ${provider.color}`}>{provider.letter}</div>
            <div className="mh-provider-info"><strong>{provider.name}</strong><small>{provider.detail}</small></div>
            <span className="mh-status planned">Not available yet</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ApiKeyManager() {
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
    onError: (err) => setError(err?.message || "Could not create the API key."),
  });
  const revoke = useMutation({
    mutationFn: (keyId) => invokeFunction("api-keys", { action: "revoke", key_id: keyId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["aevotron-api-keys"] }),
    onError: (err) => setError(err?.message || "Could not revoke the API key."),
  });
  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
    } catch {
      setError("Clipboard access is unavailable. Select and copy the key manually.");
    }
  };

  return (
    <>
      <div className="mh-page-heading">
        <div><div className="mh-eyebrow">ACCESS CONTROL</div><h1>API keys</h1>
          <p>Create and revoke credentials for your applications.</p></div>
      </div>
      {revealedKey && <div className="mh-panel mh-secret-reveal" role="status">
        <div className="mh-secret-heading"><ShieldCheck size={18}/><strong>Your new API key</strong></div>
        <p>This key is shown only once. Copy it now and store it in your password manager.</p>
        <div className="mh-secret-value"><code>{revealedKey}</code></div>
        <div className="mh-secret-actions">
          <button className="mh-button mh-button-primary" onClick={copyKey}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copied" : "Copy key"}</button>
          <button className="mh-button mh-button-quiet" onClick={() => setRevealedKey("")}>I saved it</button>
        </div>
      </div>}
      <div className="mh-panel mh-key-create">
        <div className="mh-panel-heading"><div><h3>Create an API key</h3><p>The full value is generated once. Only its HMAC hash is stored.</p></div></div>
        <form className="mh-key-form" onSubmit={(event) => {event.preventDefault();setError("");create.mutate();}}>
          <div className="mh-key-form-name"><label className="mh-field-label" htmlFor="api-key-name">Key name</label>
            <input id="api-key-name" className="mh-field" value={name} onChange={(event) => setName(event.target.value)}
              maxLength={60} placeholder="My application" /></div>
          <div className="mh-key-form-expiry"><label className="mh-field-label" htmlFor="api-key-expiry">Expires in</label>
            <select id="api-key-expiry" className="mh-field" value={expiry} onChange={(event) => setExpiry(event.target.value)}>
              <option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option>
            </select></div>
          <button className="mh-button mh-button-primary" type="submit" disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Creating…" : <><Plus size={15}/> Create key</>}
          </button>
        </form>
        {error && <div className="mh-inline-error" role="alert">{error}</div>}
      </div>
      <div className="mh-panel mh-key-list-panel">
        <div className="mh-panel-heading"><div><h3>Existing keys</h3><p>Revoke a key immediately if it is no longer needed.</p></div>
          <span className="mh-step-count">{query.data?.keys?.length ?? 0} total</span></div>
        {query.isLoading ? <div className="mh-empty">Loading API keys…</div> :
          query.isError ? <div className="mh-inline-error">Could not load API keys. Refresh the page and try again.</div> :
          !query.data?.keys?.length ? <div className="mh-empty">No API keys have been created yet.</div> :
          <div className="mh-key-list">{query.data.keys.map((key) => (
            <div className="mh-key-row" key={key.id}>
              <div className="mh-key-main"><strong>{key.name}</strong><code>{key.key_prefix}••••••••••</code>
                <small>Created {key.created_date ? new Date(key.created_date).toLocaleDateString() : "recently"} · Expires {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : "Never"}</small></div>
              <div className="mh-key-actions"><span className={`mh-status ${key.status === "active" ? "byok" : "planned"}`}>{key.status}</span>
                {["active", "expired"].includes(key.status) && <button className="mh-button mh-button-danger" disabled={revoke.isPending} onClick={() => {setError("");revoke.mutate(key.id);}}>Revoke</button>}</div>
            </div>
          ))}</div>}
      </div>
    </>
  );
}

function UsageDashboard() {
  const query = useQuery({
    queryKey: ["usage-events"],
    queryFn: () => invokeFunction("usage", { action: "events" }),
    staleTime: 30_000,
    retry: 1,
  });
  const summary = query.data?.summary;
  const events = query.data?.events || [];

  return (
    <>
      <div className="mh-page-heading">
        <div><div className="mh-eyebrow">OBSERVABILITY</div><h1>Usage & logs</h1>
          <p>Recent gateway activity, token counts, latency and provider errors. Prompts and responses are not stored.</p></div>
      </div>
      <div className="mh-stats">
        <Stat icon={Activity} label="Requests" value={summary?.requests ?? "—"} note="Last 30 days"/>
        <Stat icon={Cpu} label="Tokens" value={summary?.tokens ?? "—"} note="Input + output"/>
        <Stat icon={Zap} label="Avg. latency" value={summary?.average_latency_ms ? `${summary.average_latency_ms} ms` : "—"} note="Successful and failed calls"/>
        <Stat icon={ShieldCheck} label="Error rate" value={summary ? `${summary.error_rate}%` : "—"} note="Last 30 days"/>
      </div>
      <div className="mh-panel mh-usage-panel">
        <div className="mh-panel-heading"><div><h3>Recent requests</h3><p>Metadata only · latest 50 events</p></div>
          <span className="mh-step-count">{events.length} events</span></div>
        {query.isLoading ? <div className="mh-empty">Loading usage records…</div> :
          query.isError ? <div className="mh-inline-error">Could not load usage records. Refresh the page and try again.</div> :
          !events.length ? <div className="mh-empty">No gateway requests have been recorded yet.</div> :
          <div className="mh-usage-table-wrap"><table className="mh-usage-table">
            <thead><tr><th>TIME</th><th>MODEL</th><th>TOKENS</th><th>LATENCY</th><th>STATUS</th></tr></thead>
            <tbody>{events.map((event) => (
              <tr key={event.id}>
                <td>{event.created_at ? new Date(event.created_at).toLocaleString() : "—"}</td>
                <td><strong>{event.model_id}</strong><small>{event.provider_code}</small></td>
                <td>{event.input_tokens + event.output_tokens}</td>
                <td>{event.latency_ms ? `${event.latency_ms} ms` : "—"}</td>
                <td><span className={`mh-status ${event.status_code >= 400 ? "planned" : "byok"}`}>{event.status_code || "—"}</span>
                  {event.error_code && <small className="mh-usage-error-code">{event.error_code}</small>}</td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </>
  );
}

function Stat({icon:Icon,label,value,note}) { return <div className="mh-stat"><div className="mh-stat-icon"><Icon size={17}/></div><div className="mh-stat-label">{label}</div><div className="mh-stat-value">{value}</div><div className="mh-stat-note">{note}</div></div>; }
function Step({number,title,desc,action,onClick,icon:Icon}) { return <div className="mh-step"><div className="mh-step-number">{number}</div><div className="mh-step-icon"><Icon size={18}/></div><div className="mh-step-copy"><h3>{title}</h3><p>{desc}</p><button className="mh-text-link" onClick={onClick}>{action} <ArrowUpRight size={14}/></button></div><div className="mh-step-check"><span/></div></div>; }
function ModelRow({model,onClick}) { return <button className="mh-popular-row" onClick={onClick}><span className={`mh-provider-dot ${model.color}`}/><span><strong>{model.name}</strong><small>{model.provider}</small></span><span className="mh-popular-price">{model.price}</span><ArrowUpRight size={14}/></button>; }