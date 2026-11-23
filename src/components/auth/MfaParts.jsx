import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ThemeSwitcher } from "@/lib/ThemeSwitcher";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { loadSignInOptions } from "@/lib/authMfaFlow";
import { safeReturnTo } from "@/lib/authReturnTo";

// Building blocks shared by MfaFlow, MfaMethodSetup and MfaManage.

let appInfo;

// The app's name and sign-in settings, as login-info reports them.
export function useAppInfo() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    appInfo ||= loadSignInOptions().catch(() => ({}));
    appInfo.then((value) => setInfo(value || {}));
  }, []);
  return info;
}

// A whole page holding one MFA card. MfaFlow and MfaManage are card content, so a page that
// shows them returns <MfaScreen> in place of its own layout instead of nesting them in its card.
export function MfaScreen({ children }) {
  const { t } = useTranslation(["auth", "translation"]);
  return (
    <div className="auth-page auth-mfa-page">
      <header className="auth-topbar">
        <Link to="/" className="auth-brand" aria-label="AEVOTRON — Home">
          <span className="auth-brand-mark" aria-hidden="true">A</span>
          <span>AEVOTRON</span>
        </Link>
        <div className="auth-top-actions">
          <Link to="/" className="auth-home-link">{t("Back to home")}</Link>
          <ThemeSwitcher />
        </div>
      </header>
      <main className="auth-main">
        <section className="auth-card">{children}</section>
      </main>
    </div>
  );
}

// An icon, a title and a description, then the step's controls. A title that waits for the app's
// name is null until it loads, so the right text appears once instead of replacing a placeholder.
export function MfaHeader({ title, description }) {
  return (
    <div className="flex flex-col items-center text-center mb-6">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
        <ShieldCheck className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground min-h-[2rem]">{title}</h1>
      {description && <p className="text-muted-foreground mt-2">{description}</p>}
    </div>
  );
}

// Six digits. Like the built-in code box, any change that leaves six digits, a paste over a full code
// included, and the Enter key both call onComplete with the code as it stands.
export function CodeField({ id, label, value, onChange, onComplete, hasError = false }) {
  const { t } = useTranslation(["auth", "translation"]);
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block text-center font-normal text-muted-foreground">{label ? t(label) : t("Enter the 6-digit code")}</Label>
      <InputOTP id={id} maxLength={6} value={value} autoFocus autoComplete="one-time-code" containerClassName="justify-center"
        onChange={(next) => { onChange(next); if (next.length === 6) onComplete?.(next); }}
        onKeyDown={(e) => { if (e.key === "Enter" && onComplete) { e.preventDefault(); onComplete(value); } }}>
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <InputOTPSlot key={index} index={index} className={hasError ? "border-destructive" : undefined} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

// "Didn't receive a code? Resend", counting down while a resend isn't allowed yet.
export function ResendLine({ cooldown, disabled, onResend, error }) {
  const { t } = useTranslation(["auth", "translation"]);
  return (
    <div className="space-y-1 text-center">
      <p className="text-sm text-muted-foreground">
        {t("Didn't receive a code?")}{" "}
        {cooldown > 0 ? (
          <span>{t("Resend in {{count}}s", { count: cooldown })}</span>
        ) : (
          <button type="button" disabled={disabled} onClick={onResend} className="font-semibold text-foreground hover:underline disabled:opacity-50">
            {t("Resend")}
          </button>
        )}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// An expired or used-up challenge can't be retried: send the user back through sign-in
// (signInPath "/mfa" for factor management, whose sign-in lives on that page). The server's
// wording for that case already says "sign in again", so it is replaced, not repeated.
export function MfaNotice({ error, signInPath = "/login" }) {
  const { t } = useTranslation(["auth", "translation"]);
  if (!error) return null;
  const returnTo = safeReturnTo();
  return (
    <div role="alert" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
      {error.mustSignInAgain ? (
        <>
          {t("Your sign-in expired.")}{" "}
          <a href={signInPath + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")} className="font-medium underline">
            {t("Sign in again")}
          </a>
        </>
      ) : t(error.message || "Verification failed. Please try again.", { defaultValue: error.message || t("Verification failed. Please try again.") })}
    </div>
  );
}

export function RememberDevice({ checked, onChange }) {
  const { t } = useTranslation(["auth", "translation"]);
  return (
    <label className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <input type="checkbox" className="h-4 w-4 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {t("Remember this device for 30 days")}
    </label>
  );
}

// Seconds left before another text message can be sent.
export function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return [left, setLeft];
}

// Phones and tablets run the authenticator app on this device, so a QR code can't be scanned.
export function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}