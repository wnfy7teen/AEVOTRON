import { ErrorComponent, Link, rootRouteId, useMatch, useRouter, useTranslation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export function DefaultCatchBoundary({ error }) {
  const { t } = useLanguage();
  const router = useRouter();
  const isRoot = useMatch({ strict: false, select: (state) => state.id === rootRouteId });
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-24">
      <ErrorComponent error={error} />
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.invalidate()}>{t("Try again")}</Button>
        <Button asChild>{isRoot ? <Link to="/">{t("Home")}</Link> : <Link to="/" onClick={(e) => { e.preventDefault(); window.history.back(); }}>{t("Go back")}</Link>}</Button>
      </div>
    </div>
  );
}
