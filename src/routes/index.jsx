import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Boxes, Code2, ShieldCheck, Workflow } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aevotron — One API. Every model." },
      { name: "description", content: "Unified API infrastructure for AI models." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const features = [
    { icon: Boxes, title: "One model interface", text: "A consistent API surface across supported model providers." },
    { icon: ShieldCheck, title: "Credentials under control", text: "BYOK-first design with server-side secret handling and scoped access." },
    { icon: Code2, title: "Built for developers", text: "OpenAI-compatible requests, usage records, and practical documentation." },
  ];
  return (
    <main className="min-h-screen bg-[#080D18] text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link to="/" className="flex items-center gap-3 font-semibold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"><Workflow size={19}/></span>
          <span className="text-xl">Aevotron</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link to="/login" className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:text-white">Sign in</Link>
          <Link to="/register" className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200">Get started <ArrowRight className="ml-1 inline" size={15}/></Link>
        </nav>
      </header>
      <section className="mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-10 lg:pt-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1.5 text-xs font-medium tracking-wide text-cyan-200"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300"/> UNIFIED AI INFRASTRUCTURE</div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.06] tracking-[-.045em] sm:text-6xl lg:text-7xl">One API.<br/><span className="text-cyan-200">Every model.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">Connect AI providers through one consistent interface. Route requests, manage credentials, and understand usage from a single workspace.</p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link to="/register" className="rounded-xl bg-cyan-300 px-6 py-3.5 text-sm font-semibold text-slate-950 hover:bg-cyan-200">Create your workspace <ArrowRight className="ml-2 inline" size={16}/></Link>
            <Link to="/login" className="rounded-xl border border-white/10 px-6 py-3.5 text-sm font-medium text-slate-200 hover:border-white/25">Sign in</Link>
          </div>
          <p className="mt-5 text-xs text-slate-500">BYOK-first architecture · No platform-funded API usage in the initial release</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0D1524] p-5 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-2 text-sm font-medium"><span className="h-2 w-2 rounded-full bg-emerald-400"/> Gateway architecture</div><span className="text-xs text-slate-500">Preview</span></div>
          <div className="my-6 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-center"><div className="text-xs uppercase tracking-[.2em] text-cyan-200">Aevotron API</div><div className="mt-2 font-mono text-sm text-slate-200">/v1/chat/completions</div></div>
          <div className="grid grid-cols-2 gap-3">{["OpenAI","Anthropic","Google AI","OpenAI-compatible"].map((name,i)=><div key={name} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] p-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-300/10 text-xs font-bold text-cyan-200">{name[0]}</span><span className="text-sm text-slate-300">{name}</span></div>)}</div>
          <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-slate-500"><ShieldCheck size={15} className="text-cyan-200"/> Provider credentials remain server-side</div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-24 sm:grid-cols-3 lg:px-10">
        {features.map(({icon:Icon,title,text})=><article key={title} className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><Icon size={20} className="text-cyan-200"/><h2 className="mt-5 text-base font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></article>)}
      </section>
      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-slate-600">Aevotron · Preview release · Availability depends on provider terms and regional access</footer>
    </main>
  );
}