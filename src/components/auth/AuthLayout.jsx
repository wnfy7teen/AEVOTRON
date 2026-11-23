import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ThemeSwitcher } from "@/lib/ThemeSwitcher";

// Shared visual shell for login, registration, recovery, reset and verification.
export function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const { t } = useTranslation(["auth", "translation"]);

  return (
    <div className="auth-page">
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
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-heading">
            <div className="auth-icon">
              {Icon && <Icon aria-hidden="true" />}
            </div>
            <h1 id="auth-title">{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <div className="auth-card-content">{children}</div>
          {footer && <p className="auth-card-footer">{footer}</p>}
        </section>
      </main>
    </div>
  );
}
