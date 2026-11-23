import { UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { AuthLayout } from "./AuthLayout";

// Signed in to Base44, but not a user of this app (invite-only apps).
export function UserNotRegistered() {
  const { t } = useTranslation(["auth", "translation"]);
  const { logout } = useAuth();
  return (
    <AuthLayout icon={UserX} title={t("Access not granted")} subtitle={t("Your account is not registered for this app.")}>
      <p className="mb-6 text-center text-sm text-foreground">{t("Ask the app owner for an invitation, or sign in with a different account.")}</p>
      <Button variant="outline" className="h-12 w-full font-medium" onClick={logout}>
        {t("Sign out")}
      </Button>
    </AuthLayout>
  );
}