import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { NotFound } from "@/components/NotFound";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/AuthContext";
import { LanguageProvider, LanguageSwitcher } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n.functions";
import { getRouteNamespace, loadLocaleResources, normalizeLanguage, translateForLanguage } from "@/i18n";
import themeTokensCss from "@/theme-tokens.css?url";
import appCss from "@/index.css?url";
import appleCss from "@/apple-style.css?url";
import themeOverridesCss from "@/theme-overrides.css?url";
import authCss from "@/auth-theme.css?url";
import responsiveCss from "@/responsive.css?url";

export const Route = createRootRoute({
  loader: async ({ location }) => {
    const locale = await getRequestLocale();
    const namespace = getRouteNamespace(location.pathname);
    const resources = namespace ? await loadLocaleResources(locale, [namespace]) : {};
    return { locale, resources };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale || "en";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { title: translateForLanguage(locale, "Aevotron — One API. Every model.") },
        { name: "description", content: translateForLanguage(locale, "Unified API infrastructure for AI models.") },
      ],
      links: [
        { rel: "stylesheet", href: themeTokensCss },
        { rel: "stylesheet", href: appCss },
        { rel: "stylesheet", href: appleCss },
        { rel: "stylesheet", href: themeOverridesCss },
        { rel: "stylesheet", href: authCss },
        { rel: "stylesheet", href: responsiveCss },
      ],
    };
  },
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
  component: RootComponent,
});

function RootComponent() {
  const { locale, resources } = Route.useLoaderData();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <LanguageProvider initialLanguage={locale} initialResources={resources}>
      <AuthProvider>
        <div key={pathname} className="apple-app app-route-transition">
          <RouteNamespaceGate><Outlet /></RouteNamespaceGate>
        </div>
        <DocumentMetadataSync />
        <Toaster />
        <LanguageSwitcher />
      </AuthProvider>
    </LanguageProvider>
  );
}

function RouteNamespaceGate({ children }) {
  const { i18n } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const namespace = getRouteNamespace(pathname);
  const routeKey = `${language}:${namespace || "core"}:${pathname}`;
  const [readyKey, setReadyKey] = useState(() =>
    !namespace || i18n.hasResourceBundle(language, namespace) ? routeKey : ""
  );

  useEffect(() => {
    let cancelled = false;
    if (!namespace || i18n.hasResourceBundle(language, namespace)) {
      setReadyKey(routeKey);
      return () => { cancelled = true; };
    }

    setReadyKey("");
    void loadLocaleResources(language, [namespace]).then((resources) => {
      if (cancelled) return;
      if (!i18n.hasResourceBundle(language, namespace)) {
        i18n.addResourceBundle(language, namespace, resources[namespace] || {}, true, true);
      }
      setReadyKey(routeKey);
    }).catch(() => {
      if (!cancelled) setReadyKey(routeKey);
    });

    return () => { cancelled = true; };
  }, [i18n, language, namespace, routeKey]);

  if (readyKey !== routeKey) {
    return <div className="av-translation-loading" role="status" aria-label="Loading translations" />;
  }
  return children;
}

function RootDocument({ children }) {
  const loaderData = useRouterState({
    select: (state) => state.matches.find((match) => match.routeId === "__root__")?.loaderData,
  });
  const language = normalizeLanguage(loaderData?.locale || "en");
  return (
    <html lang={language === "zh" ? "zh-CN" : language} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var p=location.pathname;var t=p==="/"? "dark":"light";try{var saved=localStorage.getItem("aevotron-theme");var settings=JSON.parse(localStorage.getItem("aevotron-workspace-settings")||"{}");var preference=saved||settings.theme;t=preference==="light"?"light":(preference==="dark"||preference==="gray")?"dark":t;localStorage.setItem("aevotron-theme",t);if(settings.theme==="gray"||settings.theme==="dark")localStorage.setItem("aevotron-workspace-settings",JSON.stringify(Object.assign({},settings,{theme:"dark"})));}catch(e){}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;var syncApps=function(node){if(location.pathname==="/"||!node||node.nodeType!==1)return;var current=document.documentElement.dataset.theme||t;if(node.matches&&node.matches(".apple-app"))node.dataset.theme=current;if(node.querySelectorAll)node.querySelectorAll(".apple-app").forEach(function(app){app.dataset.theme=current;});};syncApps(document.documentElement);if(window.MutationObserver){var observer=new MutationObserver(function(records){records.forEach(function(record){record.addedNodes.forEach(syncApps);});});observer.observe(document.documentElement,{childList:true,subtree:true});}})();` }} />
        <HeadContent />
      </head>
      <body data-react-root="true">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function DocumentMetadataSync() {
  const { t, i18n } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    const metadata = {
      "/": ["AEVOTRON — Все модели. Один API.", "Единый API для подключения AI-моделей разных провайдеров."],
      "/login": ["Sign in — Aevotron", "Unified API infrastructure for AI models."],
      "/register": ["Create account — Aevotron", "Unified API infrastructure for AI models."],
      "/forgot-password": ["Reset password — Aevotron", "Unified API infrastructure for AI models."],
      "/reset-password": ["Choose a new password — Aevotron", "Unified API infrastructure for AI models."],
      "/mfa": ["Two-factor authentication — Aevotron", "Unified API infrastructure for AI models."],
      "/verify-email": ["Verify email — Aevotron", "Unified API infrastructure for AI models."],
      "/dashboard": ["Aevotron — Workspace", "One API for every AI model."],
      "/workspace": ["AEVOTRON — AI Workspace", "Chat with connected AI models."],
    };
    const [titleKey, descriptionKey] = metadata[pathname] || ["Aevotron — One API. Every model.", "Unified API infrastructure for AI models."];
    document.title = t(titleKey);
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", t(descriptionKey));
  }, [i18n.resolvedLanguage, pathname, t]);
  return null;
}
