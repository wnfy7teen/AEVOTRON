import "./landing.css";
import "./hero-orbit.css";
import { OrbitalBadge } from "./OrbitalBadge";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronRight, Copy, Menu, Moon, ShieldCheck, Sparkles, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { createPortal } from "react-dom";

type FeatureVisualProps = { variant: "routing" | "control" | "integration"; t: (value: string) => string };

function FeatureVisual({ variant, t }: FeatureVisualProps) {
  if (variant === "routing") {
    return <div className="av-visual av-routing" aria-label={t("Схема единого API и подключённых моделей")}>
      <div className="av-api-node"><span className="av-node-mark">A</span><strong>AEVOTRON API</strong><small>{t("Единая точка доступа")}</small><code>POST /v1/chat/completions</code></div>
      <div className="av-routing-lines"><i /><i /><i /></div>
      <div className="av-provider-stack">{["OpenAI", "Anthropic", "Google"].map((name, index) => <div className="av-provider" key={name}><span className={"av-provider-symbol av-symbol-" + index}>{name[0]}</span><strong>{name}</strong><span className="av-provider-state"><Check size={13} /> {t("Подключено")}</span></div>)}</div>
    </div>;
  }
  if (variant === "control") {
    return <div className="av-visual av-control" aria-label={t("Интерфейс управления API-ключами")}>
      <div className="av-window-bar"><span /><span /><span /><small>{t("Безопасность · API-ключи")}</small></div>
      <div className="av-control-inner"><div><small>{t("АКТИВНЫЙ КЛЮЧ")}</small><strong>sk-live-••••••••••••8F2A</strong><span>{t("Создан сегодня · Полный доступ")}</span></div><div className="av-key-status"><ShieldCheck size={18} /> {t("Защищён")}</div></div>
      <div className="av-permissions"><span>{t("Разрешения")}</span><b>{t("Chat completions")}</b><b>{t("Embeddings")}</b><b>{t("Usage")}</b></div>
      <div className="av-control-footer"><span>{t("Последнее использование")}</span><strong>{t("2 минуты назад")}</strong></div>
    </div>;
  }
  return <div className="av-visual av-code" aria-label={t("Пример запроса к API AEVOTRON")}>
    <div className="av-window-bar"><span /><span /><span /><small>{t("request.ts")}</small></div>
    <pre><span className="av-code-muted">const</span> response = <span className="av-code-blue">await</span> fetch(</pre>
    <pre>  <span className="av-code-green">"https://api.aevotron.com/v1/chat/completions"</span>,</pre>
    <pre>  {"{"} method: <span className="av-code-green">"POST"</span>,</pre>
    <pre>    headers: {"{"} Authorization: <span className="av-code-green">"Bearer YOUR_KEY"</span> {"}"},</pre>
    <pre>    body: JSON.stringify({"{"}</pre>
    <pre>      model: <span className="av-code-green">"provider/model-name"</span>,</pre>
    <pre>      messages: [{"{"} role: <span className="av-code-green">"user"</span>, content: <span className="av-code-green">"Hello"</span> {"}"}]</pre>
    <pre>    {"}"})</pre><pre>  {"}"});</pre>
    <div className="av-code-result"><span /><span>200 OK</span><small>{t("Ответ получен")}</small></div>
  </div>;
}

type Feature = { eyebrow: string; title: string; description: string; variant: FeatureVisualProps["variant"]; reverse?: boolean };
const features: Feature[] = [
  { eyebrow: "ЕДИНЫЙ ИНТЕРФЕЙС", title: "Разные модели. Один способ работы.", description: "Подключайтесь к моделям разных провайдеров через согласованный API и меняйте модели без перестройки интеграции.", variant: "routing" },
  { eyebrow: "КОНТРОЛЬ ДОСТУПА", title: "Ваши ключи. Ваши правила.", description: "Храните учётные данные провайдеров на серверной стороне и управляйте доступом из одного рабочего пространства.", variant: "control", reverse: true },
  { eyebrow: "ДЛЯ РАЗРАБОТЧИКОВ", title: "Интеграция,\u00a0которая не мешает работе.", description: "Используйте привычный формат запросов, подключайте существующие инструменты и сосредоточьтесь на своём продукте.", variant: "integration" },
];

export default function AppleLanding() {
  const { language, t } = useLanguage(["landing", "translation"]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState("platform");
  const [theme, setTheme] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("aevotron-theme") === "light" ? "light" : "dark");
  useEffect(() => {
    window.localStorage.setItem("aevotron-theme", theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const codeExample = document.querySelector(".av-site .av-code");
    if (!codeExample) return;
    let observer: IntersectionObserver | undefined;
    let timer: number | undefined;
    let cancelled = false;
    const startTyping = () => {
      if (cancelled || codeExample.classList.contains("is-typing")) return;
      codeExample.classList.add("is-typing");
      const lines = Array.from(codeExample.querySelectorAll("pre"));
      const characters: HTMLSpanElement[] = [];
      lines.forEach((line) => {
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
        const textNodes: Text[] = [];
        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
          if (node.parentElement?.closest(".av-typed-char")) continue;
          textNodes.push(node);
        }
        textNodes.forEach((node) => {
          const fragment = document.createDocumentFragment();
          Array.from(node.textContent ?? "").forEach((character) => {
            const span = document.createElement("span");
            span.className = "av-typed-char";
            span.textContent = character;
            span.style.opacity = "0";
            fragment.appendChild(span);
            characters.push(span);
          });
          node.parentNode?.replaceChild(fragment, node);
        });
      });
      const result = codeExample.querySelector(".av-code-result") as HTMLElement | null;
      if (result) result.style.opacity = "0";
      let index = 0;
      const typeNext = () => {
        if (cancelled) return;
        if (index < characters.length) {
          characters[index].style.opacity = "1";
          index += 1;
          timer = window.setTimeout(typeNext, 18);
        } else if (result) {
          result.style.opacity = "1";
          result.classList.add("is-typed");
        }
      };
      typeNext();
    };
    if (!("IntersectionObserver" in window)) {
      startTyping();
    } else {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          startTyping();
          observer?.disconnect();
        }
      }, { threshold: 0.05, rootMargin: "0px 0px 100px 0px" });
      observer.observe(codeExample);
    }
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [language]);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const controlExample = document.querySelector(".av-site .av-control");
    if (!controlExample) return;
    let observer: IntersectionObserver | undefined;
    let timer: number | undefined;
    let cancelled = false;

    const startTyping = () => {
      if (cancelled || controlExample.classList.contains("is-typing")) return;
      controlExample.classList.add("is-typing");
      const targets = controlExample.querySelectorAll(
        ".av-control-inner small, .av-control-inner strong, .av-control-inner span, .av-key-status, .av-permissions span, .av-permissions b, .av-control-footer span, .av-control-footer strong"
      );
      const characters: HTMLSpanElement[] = [];
      targets.forEach((target) => {
        const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
        const textNodes: Text[] = [];
        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
          if (node.parentElement?.closest(".av-typed-char")) continue;
          if (node.textContent) textNodes.push(node);
        }
        textNodes.forEach((node) => {
          const fragment = document.createDocumentFragment();
          Array.from(node.textContent ?? "").forEach((character) => {
            const span = document.createElement("span");
            span.className = "av-typed-char";
            span.textContent = character;
            span.style.opacity = "0";
            fragment.appendChild(span);
            characters.push(span);
          });
          node.parentNode?.replaceChild(fragment, node);
        });
      });

      let index = 0;
      const typeNext = () => {
        if (cancelled) return;
        if (index < characters.length) {
          characters[index].style.opacity = "1";
          index += 1;
          timer = window.setTimeout(typeNext, 24);
        }
      };
      typeNext();
    };

    if (!("IntersectionObserver" in window)) {
      startTyping();
    } else {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          startTyping();
          observer?.disconnect();
        }
      }, { threshold: 0.08, rootMargin: "0px 0px 100px 0px" });
      observer.observe(controlExample);
    }

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [language]);
  const copyEndpoint = async () => {
    try { await navigator.clipboard.writeText("https://api.aevotron.com/v1"); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };
  return <>
  <main className="av-site" data-theme={theme}>
    <header className="av-header"><div className="av-nav-wrap">
      <Link to="/" className="av-brand" aria-label={t("AEVOTRON — главная")}><span className="av-brand-mark">A</span><span>AEVOTRON</span></Link>
      <nav className={"av-nav-links " + (menuOpen ? "is-open" : "")} aria-label={t("Основная навигация")}>
        <a href="#platform" onClick={() => { setMenuOpen(false); setActiveSection("platform"); }}>{t("Платформа")}</a><a href="#security" onClick={() => { setMenuOpen(false); setActiveSection("security"); }}>{t("Безопасность")}</a><a href="#developers" onClick={() => { setMenuOpen(false); setActiveSection("developers"); }}>{t("Разработчикам")}</a>
      </nav>
      <div className="av-nav-actions"><Link to="/workspace" className="av-login av-workspace-link">{t("Workspace")}</Link><Link to="/login" search={{ demo: "1" }} className="av-login">{t("Войти")}</Link><Link to="/register" className="av-nav-cta">{t("Начать работу")} <ArrowRight size={15} /></Link></div>
      <div className="av-theme-switch" role="group" aria-label={t("Тема оформления")}>
        <button type="button" className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")} aria-label={t("Тёмная тема")} aria-pressed={theme === "dark"} title={t("Тёмная")}><Moon size={14} aria-hidden="true" /><span>{t("Тёмная")}</span></button>
        <button type="button" className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")} aria-label={t("Светлая тема")} aria-pressed={theme === "light"} title={t("Светлая")}><Sun size={14} aria-hidden="true" /><span>{t("Светлая")}</span></button>
      </div>
      <button type="button" className="av-menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label={menuOpen ? t("Close navigation") : t("Open navigation")}>{menuOpen ? <X /> : <Menu />}</button>
    </div></header>
    <section className="av-hero av-reveal" id="platform">
      <div className="av-hero-kicker"><span /> {t("ИНФРАСТРУКТУРА ДЛЯ AI-ПРОДУКТОВ")}</div>
      <h1>{t("Все модели.")}<br /><span>{t("Один API.")}</span></h1>
      <p className="av-hero-copy">{t("Подключайте AI-модели разных провайдеров через единый интерфейс — без лишней сложности в интеграциях.")}</p>
      <div className="av-hero-actions"><Link to="/register" className="av-primary-button">{t("Создать аккаунт")} <ArrowRight size={17} /></Link><a href="#developers" className="av-secondary-button">{t("Как это работает")} <ChevronRight size={17} /></a></div>
      <div className="av-hero-footnote"><ShieldCheck size={15} /><span className="av-hero-footnote-text">{t("Архитектура BYOK · Ваши ключи провайдеров остаются под вашим контролем")}</span></div>
      <OrbitalBadge />
    </section>
    <section className="av-intro av-reveal"><p>{t("ЕДИНАЯ СРЕДА ДЛЯ РАБОТЫ С МОДЕЛЯМИ")}</p><h2>{t("Меньше связующего кода.")}<br />{t("Больше времени на продукт.")}</h2></section>
    {features.map((feature, index) => <section className={"av-feature av-reveal " + (feature.reverse ? "av-feature-reverse" : "")} id={index === 1 ? "security" : index === 2 ? "developers" : undefined} key={feature.variant}>
      <div className="av-feature-copy"><span className="av-eyebrow">{t(feature.eyebrow)}</span><h2>{t(feature.title)}</h2><p>{t(feature.description)}</p>{index === 2 && <button className="av-inline-link" onClick={copyEndpoint}>{copied ? <><Check size={15} /> {t("Скопировано")}</> : <><Copy size={15} /> {t("Скопировать адрес API")}</>}</button>}</div>
      <FeatureVisual key={`${feature.variant}-${language}`} variant={feature.variant} t={t} />
    </section>)}
    <section className="av-final-cta av-reveal"><div className="av-final-icon"><Sparkles size={22} /></div><h2>{t("Создайте свою следующую интеграцию.")}</h2><p>{t("Начните с одного API и подключайте нужные модели по мере роста проекта.")}</p><Link to="/register" className="av-primary-button">{t("Начать работу")} <ArrowRight size={17} /></Link></section>
    <footer className="av-footer av-reveal">
      <div className="av-footer-main">
        <div className="av-footer-brand">
          <Link to="/" className="av-brand"><span className="av-brand-mark">A</span><span>AEVOTRON</span></Link>
          <p>{t("Единый интерфейс для AI-моделей.")}</p>
        </div>
        <div className="av-footer-column">
          <span className="av-footer-heading">{t("РАЗДЕЛЫ")}</span>
          <a href="#platform">{t("Платформа")}</a>
          <a href="#security">{t("Безопасность")}</a>
          <a href="#developers">{t("Разработчикам")}</a>
        </div>
        <div className="av-footer-column">
          <span className="av-footer-heading">{t("АККАУНТ")}</span>
          <Link to="/login" search={{ demo: "1" }}>{t("Войти")}</Link>
          <Link to="/register">{t("Регистрация")}</Link>
        </div>
        <div className="av-footer-column av-footer-contact">
          <span className="av-footer-heading">{t("СВЯЗАТЬСЯ")}</span>
          <a href="https://t.me/web3ResearchCN" target="_blank" rel="noreferrer">{t("Telegram · @web3ResearchCN")}</a>
          <a href="mailto:usdtuser1@proton.me">usdtuser1@proton.me</a>
        </div>
      </div>
      <div className="av-footer-bottom">
        <small>© {new Date().getFullYear()} AEVOTRON. <span>{t("Все права защищены.")}</span></small>
        <span>{t("Developed by")} <strong>Kristofer Biksan</strong></span>
      </div>
    </footer>
  </main>
  {typeof document !== "undefined" && createPortal(
    <aside className="av-section-nav is-visible" data-theme={theme} aria-label={t("Навигация по разделам")}>
      <span className="av-section-nav-label">{t("НА СТРАНИЦЕ")}</span>
      <a href="#platform" onClick={() => setActiveSection("platform")} className={activeSection === "platform" ? "active" : ""} aria-current={activeSection === "platform" ? "location" : undefined}><i />{t("Platform")}</a>
      <a href="#security" onClick={() => setActiveSection("security")} className={activeSection === "security" ? "active" : ""} aria-current={activeSection === "security" ? "location" : undefined}><i />{t("Security")}</a>
      <a href="#developers" onClick={() => setActiveSection("developers")} className={activeSection === "developers" ? "active" : ""} aria-current={activeSection === "developers" ? "location" : undefined}><i />{t("Developers")}</a>
    </aside>,
    document.body
  )}
  </>;
}
