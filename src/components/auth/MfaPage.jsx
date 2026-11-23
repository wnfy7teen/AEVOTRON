import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { MfaManage } from "@/components/auth/MfaManage";
import { MfaScreen } from "@/components/auth/MfaParts";
import { useAuth } from "@/lib/AuthContext";
import { mfaSession } from "@/lib/authMfaFlow";

export function MfaPage() {
  const { t } = useTranslation(["auth", "translation"]);
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const session = useMemo(() => mfaSession(), []);

  if (isLoadingAuth) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>;
  }

  if (!isAuthenticated) {
    return <AuthLayout icon={ShieldCheck} title={t("Sign in required")} subtitle={t("Sign in to manage your two-factor authentication.")}>
      <Link to="/login" className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground">
        {t("Continue to sign in")}
      </Link>
    </AuthLayout>;
  }

  return <MfaScreen><MfaManage session={session} returnTo="/dashboard" /></MfaScreen>;
}
