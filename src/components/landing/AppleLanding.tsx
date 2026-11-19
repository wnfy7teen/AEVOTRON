import "./landing.css";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronRight, Copy, Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { useState } from "react";

type FeatureVisualProps = { variant: "routing" | "control" | "integration" };

function FeatureVisual({ variant }: FeatureVisualProps) {
  if (variant === "routing") {
    return <div className="av-visual av-routing" aria-label="Схема единого API и подключённых моделей">
      <div className="av-api-node"><span className="av-node-mark">A</span><strong>AEVOTRON API</strong><small>Единая точка доступа</small><code>POST /v1/chat/completions</code></div>
      <div className="av-routing-lines"><i /><i /><i /></div>
      <div className="av-provider-stack">{["OpenAI", "Anthropic", "Google"].map((name, index) => <div className="av-provider" key={name}><span className={"av-provider-symbol av-symbol-" + index}>{name[0]}</span><strong>{name}</strong><span className="av-provider-state"><Check size={13} /> Подключено</span></div>)}</div>
    </div>;
  }
  if (variant === "control") {
    return <div className="av-visual av-control" aria-label="Интерфейс управления API-ключами">
      <div className="av-window-bar"><span /><span /><span /><small>Безопасность · API-ключи</small></div>
      <div className="av-control-inner"><div><small>АКТИВНЫЙ КЛЮЧ</small><strong>sk-live-••••••••••••8F2A</strong><span>Создан сегодня · Полный доступ</span></div><div className="av-key-status"><ShieldCheck size={18} /> Защищён</div></div>
      <div className="av-permissions"><span>Разрешения</span><b>Chat completions</b><b>Embeddings</b><b>Usage</b></div>
      <div className="av-control-footer"><span>Последнее использование</span><strong>2 минуты назад</strong></div>
    </div>;
  }
  return <div className="av-visual av-code" aria-label="Пример запроса к API AEVOTRON">
    <div className="av-window-bar"><span /><span /><span /><small>request.ts</small></div>
    <pre><span className="av-code-muted">const</span> response = <span className="av-code-blue">await</span> fetch(</pre>
    <pre>  <span className="av-code-green">"https://api.aevotron.com/v1/chat/completions"</span>,</pre>
    <pre>  {"{"} method: <span className="av-code-green">"POST"</span>,</pre>
    <pre>    headers: {"{"} Authorization: <span className="av-code-green">"Bearer YOUR_KEY"</span> {"}"},</pre>
    <pre>    body: JSON.stringify({"{"}</pre>
    <pre>      model: <span className="av-code-green">"provider/model-name"</span>,</pre>
    <pre>      messages: [{"{"} role: <span className="av-code-green">"user"</span>, content: <span className="av-code-green">"Hello"</span> {"}"}]</pre>
    <pre>    {"}"})</pre><pre>  {"}"});</pre>
    <div className="av-code-result"><span /><span>200 OK</span><small>Ответ получен</small></div>
  </div>;
}

type Feature = { eyebrow: string; title: string; description: string; variant: FeatureVisualProps["variant"]; reverse?: boolean };
const features: Feature[] = [
  { eyebrow: "ЕДИНЫЙ ИНТЕРФЕЙС", title: "Разные модели. Один способ работы.", description: "Подключайтесь к моделям разных провайдеров через согласованный API и меняйте модели без перестройки интеграции.", variant: "routing" },
  { eyebrow: "КОНТРОЛЬ ДОСТУПА", title: "Ваши ключи. Ваши правила.", description: "Храните учётные данные провайдеров на серверной стороне и управляйте доступом из одного рабочего пространства.", variant: "control", reverse: true },
  { eyebrow: "ДЛЯ РАЗРАБОТЧИКОВ", title: "Интеграция, которая не мешает работе.", description: "Используйте привычный формат запросов, подключайте существующие инструменты и сосредоточьтесь на своём продукте.", variant: "integration" },
];

export default function AppleLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyEndpoint = async () => {
    try { await navigator.clipboard.writeText("https://api.aevotron.com/v1"); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };
  return <main className="av-site">
    <header className="av-header"><div className="av-nav-wrap">
      <Link to="/" className="av-brand" aria-label="AEVOTRON — главная"><span className="av-brand-mark">A</span><span>AEVOTRON</span></Link>
      <nav className={"av-nav-links " + (menuOpen ? "is-open" : "")} aria-label="Основная навигация">
        <a href="#platform" onClick={() => setMenuOpen(false)}>Платформа</a><a href="#security" onClick={() => setMenuOpen(false)}>Безопасность</a><a href="#developers" onClick={() => setMenuOpen(false)}>Разработчикам</a>
      </nav>
      <div className="av-nav-actions"><Link to="/login" className="av-login">Войти</Link><Link to="/register" className="av-nav-cta">Начать работу <ArrowRight size={15} /></Link></div>
      <button className="av-menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}>{menuOpen ? <X /> : <Menu />}</button>
    </div></header>
    <section className="av-hero" id="platform">
      <div className="av-hero-kicker"><span /> ИНФРАСТРУКТУРА ДЛЯ AI-ПРОДУКТОВ</div>
      <h1>Все модели.<br /><span>Один API.</span></h1>
      <p className="av-hero-copy">Подключайте AI-модели разных провайдеров через единый интерфейс — без лишней сложности в интеграциях.</p>
      <div className="av-hero-actions"><Link to="/register" className="av-primary-button">Создать аккаунт <ArrowRight size={17} /></Link><a href="#developers" className="av-secondary-button">Как это работает <ChevronRight size={17} /></a></div>
      <div className="av-hero-footnote"><ShieldCheck size={15} /> Архитектура BYOK · Ваши ключи провайдеров остаются под вашим контролем</div>
      <div className="av-hero-art" aria-label="Визуализация единого API AEVOTRON"><div className="av-orbit av-orbit-one" /><div className="av-orbit av-orbit-two" /><div className="av-core"><span className="av-core-mark">A</span><strong>AEVOTRON</strong><small>UNIFIED API</small></div><div className="av-orbit-label av-label-top">ONE INTERFACE</div><div className="av-orbit-label av-label-bottom">MULTIPLE MODELS</div></div>
    </section>
    <section className="av-intro"><p>ЕДИНАЯ СРЕДА ДЛЯ РАБОТЫ С МОДЕЛЯМИ</p><h2>Меньше связующего кода.<br />Больше времени на продукт.</h2></section>
    {features.map((feature, index) => <section className={"av-feature " + (feature.reverse ? "av-feature-reverse" : "")} id={index === 1 ? "security" : index === 2 ? "developers" : undefined} key={feature.variant}>
      <div className="av-feature-copy"><span className="av-eyebrow">{feature.eyebrow}</span><h2>{feature.title}</h2><p>{feature.description}</p>{index === 2 && <button className="av-inline-link" onClick={copyEndpoint}>{copied ? <><Check size={15} /> Скопировано</> : <><Copy size={15} /> Скопировать адрес API</>}</button>}</div>
      <FeatureVisual variant={feature.variant} />
    </section>)}
    <section className="av-final-cta"><div className="av-final-icon"><Sparkles size={22} /></div><h2>Создайте свою следующую интеграцию.</h2><p>Начните с одного API и подключайте нужные модели по мере роста проекта.</p><Link to="/register" className="av-primary-button">Начать работу <ArrowRight size={17} /></Link></section>
    <footer className="av-footer"><Link to="/" className="av-brand"><span className="av-brand-mark">A</span><span>AEVOTRON</span></Link><span>Единый интерфейс для AI-моделей.</span><div><Link to="/login">Войти</Link><Link to="/register">Регистрация</Link></div><small>© {new Date().getFullYear()} AEVOTRON</small></footer>
  </main>;
}
