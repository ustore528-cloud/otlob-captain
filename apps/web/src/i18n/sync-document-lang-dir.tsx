import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isRtlLang } from "@/i18n/i18n";

/** Sets <html lang> and <html dir> from active i18n language. */
export function SyncDocumentLangDir() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const apply = (lng: string) => {
      const rtl = isRtlLang(lng);
      document.documentElement.lang = lng;
      document.documentElement.dir = rtl ? "rtl" : "ltr";
    };
    apply(i18n.resolvedLanguage ?? i18n.language);
    const on = (lng: string) => apply(lng);
    i18n.on("languageChanged", on);
    return () => {
      i18n.off("languageChanged", on);
    };
  }, [i18n]);

  return null;
}
