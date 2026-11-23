import { translateForLanguage } from "@/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Loader2, MailCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function VerifyEmailPage() {
  const { t } = useTranslation(["auth", "translation"]);
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState(t("Verifying your email address…"));

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setStatus("error");
      setMessage(t("This verification link is missing its code."));
      return;
    }
    fetch("/api/v1/auth/verify-email", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || t("This verification link is invalid or expired."));
      setStatus("success");
      setMessage(t("Your email is verified. Your account is ready."));
      window.setTimeout(() => window.location.assign("/dashboard"), 900);
    }).catch((error) => {
      setStatus("error");
      setMessage(error.message);
    });
  }, []);

  return <AuthLayout icon={MailCheck} title={status === "success" ? t("Email verified") : status === "error" ? t("Verification failed") : t("Verify email")} subtitle={message}>
    {status === "verifying" && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
    {status === "error" && <Link to="/register" className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground">{t("Back to registration")}</Link>}
  </AuthLayout>;
}

export const Route = createFileRoute("/verify-email")({
  ssr: false,
  head: ({ matches }) => { const locale = matches.find((match) => match.routeId === "__root__")?.loaderData || "en"; return { meta: [{ title: translateForLanguage(locale, "Verify email — Aevotron") }] }; },
  component: VerifyEmailPage,
});
