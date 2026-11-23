import { useLanguage } from "@/lib/i18n";

export function OrbitalBadge() {
  const { t } = useLanguage(["landing", "translation"]);

  return (
    <figure
      className="av-hero-art"
      role="img"
      aria-label={t("Визуализация единого API AEVOTRON")}
    >
      <div className="av-orbit av-orbit-one" aria-hidden="true" />
      <div className="av-orbit av-orbit-two" aria-hidden="true" />

      <div className="av-orbit-track" aria-hidden="true">
        <span className="av-orbit-label av-label-top" data-orbit-start="0deg">
          <span>{t("orbit.top")}</span>
        </span>
        <span className="av-orbit-label av-label-top-right" data-orbit-start="45deg">
          <span>{t("orbit.top_right")}</span>
        </span>
        <span className="av-orbit-label av-label-right" data-no-translate="true" data-orbit-start="90deg">
          <span>{t("orbit.right")}</span>
        </span>
        <span className="av-orbit-label av-label-bottom" data-orbit-start="180deg">
          <span>{t("orbit.bottom")}</span>
        </span>
        <span className="av-orbit-label av-label-bottom-left" data-no-translate="true" data-orbit-start="225deg">
          <span>{t("orbit.bottom_left")}</span>
        </span>
        <span className="av-orbit-label av-label-left" data-no-translate="true" data-orbit-start="270deg">
          <span>{t("orbit.left")}</span>
        </span>
      </div>

      <div className="av-core">
        <span className="av-core-mark" aria-hidden="true">A</span>
        <strong>{t("core.aevotron")}</strong>
        <small>{t("core.unified_api")}</small>
      </div>
      <figcaption className="sr-only">
        {t("Визуализация единого API AEVOTRON")}
      </figcaption>
    </figure>
  );
}
