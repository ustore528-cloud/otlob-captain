import { useTranslation } from "react-i18next";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { SUPPORTED_WEB_LANGS, type WebLang } from "@/i18n/i18n";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const lng = (SUPPORTED_WEB_LANGS as readonly string[]).includes(i18n.resolvedLanguage ?? "")
    ? (i18n.resolvedLanguage as WebLang)
    : "en";

  return (
    <label className={["flex flex-col gap-1 text-xs", className].filter(Boolean).join(" ")}>
      <span className="text-muted-foreground">{t("common.language")}</span>
      <select
        className={FORM_CONTROL_CLASS + " min-w-[8rem]"}
        value={lng}
        aria-label={t("common.language")}
        onChange={(e) => void i18n.changeLanguage(e.target.value as WebLang)}
      >
        <option value="en">English</option>
        <option value="ar">العربية</option>
        <option value="he">עברית</option>
      </select>
    </label>
  );
}
