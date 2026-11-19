import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { NotFound } from "@/components/NotFound";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/AuthContext";
import { LanguageProvider, LanguageSwitcher } from "@/lib/i18n";
import { Base44Scripts } from "base44:document";
import appCss from "@/index.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Aevotron — One API. Every model." },
      { name: "description", content: "Unified API infrastructure for AI models." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
  component: RootComponent,
});

function RootComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <LanguageProvider>
      <AuthProvider>
        <div key={pathname} className="app-route-transition"><Outlet /></div>
        <Toaster />
        <LanguageSwitcher />
      </AuthProvider>
    </LanguageProvider>
  );
}

function RootDocument({ children }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body data-react-root="true">
        {children}
        <Base44Scripts />
        <Scripts />
      </body>
    </html>
  );
}
