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

      <div className="av-orbit-track av-orbit-track-inner" aria-hidden="true">
        <span className="av-orbit-label av-label-inner-top">
          <span>{t("orbit.top")}</span>
        </span>
        <span className="av-orbit-label av-label-inner-right">
          <span>{t("orbit.right")}</span>
        </span>
        <span className="av-orbit-label av-label-inner-bottom">
          <span>{t("orbit.bottom")}</span>
        </span>
      </div>

      <div className="av-orbit-track av-orbit-track-outer" aria-hidden="true">
        <span className="av-orbit-label av-label-outer-top-right">
          <span>{t("orbit.top_right")}</span>
        </span>
        <span className="av-orbit-label av-label-outer-bottom">
          <span>{t("orbit.bottom_left")}</span>
        </span>
        <span className="av-orbit-label av-label-outer-left">
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
