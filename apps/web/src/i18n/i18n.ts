import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { CUSTOMER_NOTIFICATIONS_BY_LANG } from "@captain/shared";
import ar from "@/i18n/locales/ar.json";
import en from "@/i18n/locales/en.json";
import he from "@/i18n/locales/he.json";

export const WEB_LANG_STORAGE_KEY = "captain_web_lang";
export const SUPPORTED_WEB_LANGS = ["en", "ar", "he"] as const;
export type WebLang = (typeof SUPPORTED_WEB_LANGS)[number];

export function isRtlLang(lng: string): boolean {
  return lng === "ar" || lng === "he";
}

function withCustomerNotifications<T extends Record<string, unknown>>(base: T, lang: WebLang): T {
  return { ...base, ...CUSTOMER_NOTIFICATIONS_BY_LANG[lang] } as T;
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: withCustomerNotifications(en, "en") },
      ar: { translation: withCustomerNotifications(ar, "ar") },
      he: { translation: withCustomerNotifications(he, "he") },
    },
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_WEB_LANGS],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: WEB_LANG_STORAGE_KEY,
    },
  });

export default i18n;
