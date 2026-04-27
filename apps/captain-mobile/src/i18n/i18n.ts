import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "@/locales/ar.json";
import en from "@/locales/en.json";
import he from "@/locales/he.json";

export const CAPTAIN_MOBILE_LANG_KEY = "captain_mobile_lang";

export const SUPPORTED_LANGS = ["en", "ar", "he"] as const;
export type CaptainLang = (typeof SUPPORTED_LANGS)[number];

export function isRtlLng(lng: string): boolean {
  return lng === "ar" || lng === "he";
}

const languageDetector = {
  type: "languageDetector" as const,
  async: true,
  detect: async (cb: (lng: string) => void) => {
    try {
      const stored = await AsyncStorage.getItem(CAPTAIN_MOBILE_LANG_KEY);
      if (stored === "en" || stored === "ar" || stored === "he") {
        cb(stored);
        return;
      }
    } catch {
      /* ignore */
    }
    const tag = Localization.getLocales()[0]?.languageCode;
    cb(tag === "ar" || tag === "he" ? tag : "en");
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    await AsyncStorage.setItem(CAPTAIN_MOBILE_LANG_KEY, lng);
  },
};

void i18n
  .use(languageDetector as never)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
      he: { translation: he },
    },
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGS],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

/** Persist language after `changeLanguage` (redundant with detector cache when wired, kept explicit for reliability). */
export async function persistCaptainLanguage(lng: CaptainLang): Promise<void> {
  await AsyncStorage.setItem(CAPTAIN_MOBILE_LANG_KEY, lng);
}

export default i18n;
