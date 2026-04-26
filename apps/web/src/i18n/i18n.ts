import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import ar from "@/locales/ar.json";
import en from "@/locales/en.json";
import he from "@/locales/he.json";

export const WEB_LANG_STORAGE_KEY = "captain_web_lang";
export const SUPPORTED_WEB_LANGS = ["en", "ar", "he"] as const;
export type WebLang = (typeof SUPPORTED_WEB_LANGS)[number];

export function isRtlLang(lng: string): boolean {
  return lng === "ar" || lng === "he";
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
      he: { translation: he },
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
