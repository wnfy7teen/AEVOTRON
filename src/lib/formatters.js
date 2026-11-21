import { normalizeLanguage } from "@/i18n";

const intlLocales = { en: "en-US", ru: "ru-RU", zh: "zh-CN" };

export function getIntlLocale(language) {
  return intlLocales[normalizeLanguage(language)];
}

export function formatNumber(value, language, options = {}) {
  return new Intl.NumberFormat(getIntlLocale(language), options).format(value);
}

export function formatCurrency(value, currency, language, options = {}) {
  return new Intl.NumberFormat(getIntlLocale(language), {
    style: "currency",
    currency,
    ...options,
  }).format(value);
}

export function formatDate(value, language, options = { dateStyle: "medium" }) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(getIntlLocale(language), options).format(date);
}

export function formatRelativeTime(value, unit, language, options = { numeric: "auto" }) {
  return new Intl.RelativeTimeFormat(getIntlLocale(language), options).format(value, unit);
}
