import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { NotFound } from "@/components/NotFound";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/AuthContext";
import { LanguageProvider, LanguageSwitcher } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n.functions";
import { normalizeLanguage, translateForLanguage } from "@/i18n";
import appCss from "@/index.css?url";
import appleCss from "@/apple-style.css?url";

export const Route = createRootRoute({
  loader: () => getRequestLocale(),
  head: ({ loaderData }) => {
    const locale = loaderData?.locale || loaderData || "en";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: translateForLanguage(locale, "Aevotron — One API. Every model.") },
        { name: "description", content: translateForLanguage(locale, "Unified API infrastructure for AI models.") },
      ],
      links: [{ rel: "stylesheet", href: appCss }, { rel: "stylesheet", href: appleCss }],
    };
  },
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
  component: RootComponent,
});

function RootComponent() {
  const locale = Route.useLoaderData();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <LanguageProvider initialLanguage={locale}>
      <AuthProvider>
        <div key={pathname} className="apple-app app-route-transition"><Outlet /></div>
        <DocumentMetadataSync />
        <Toaster />
        <LanguageSwitcher />
      </AuthProvider>
    </LanguageProvider>
  );
}

function RootDocument({ children }) {
  const locale = useRouterState({
    select: (state) => state.matches.find((match) => match.routeId === "__root__")?.loaderData || "en",
  });
  const language = normalizeLanguage(locale);
  return (
    <html lang={language === "zh" ? "zh-CN" : language}>
      <head><HeadContent /></head>
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
