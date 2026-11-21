import { Link } from "@tanstack/react-router";
import { AlertTriangle, Lock } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/api/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthError, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The /reset-password page; the reset email links here with ?token=.
export function ResetPasswordPage() {
  const { t } = useTranslation(["auth", "translation"]);
  // Read raw: the router's search parser would turn an all-digit token into a number.
  const token = new URLSearchParams(window.location.search).get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("Passwords do not match"));
      return;
    }
    setBusy(true);
    try {
      await api.auth.resetPassword({ resetToken: token, newPassword: password });
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || t("Failed to reset password"));
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title={t("Invalid reset link")}
        subtitle={t("This password reset link is missing or invalid")}
        footer={
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            {t("Request a new link")}
          </Link>
        }
      >
        <p className="text-center text-sm text-foreground">{t("The link you used appears to be incomplete. Please request a new password reset email.")}</p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout icon={Lock} title={t("New password")} subtitle={t("Enter your new password below")}>
      <AuthError>{error}</AuthError>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-password">{t("New password")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="reset-password" type="password" autoComplete="new-password" minLength={12} autoFocus placeholder={t("At least 12 characters")} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-confirm">{t("Confirm password")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="reset-confirm" type="password" autoComplete="new-password" minLength={12} placeholder={t("At least 12 characters")} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <SubmitButton busy={busy} busyLabel={t("Resetting...")}>
          {t("Reset password")}
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}