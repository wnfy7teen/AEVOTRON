import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { NotFound } from "@/components/NotFound";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/AuthContext";
import { LanguageProvider, LanguageSwitcher } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n.functions";
import { normalizeLanguage, translateForLanguage } from "@/i18n";
import { ThemeSwitcher } from "@/lib/ThemeSwitcher";
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
        <Toaster />
        <LanguageSwitcher />
        <ThemeSwitcher />
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
