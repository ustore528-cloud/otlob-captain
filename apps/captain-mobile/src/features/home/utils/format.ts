import i18n from "@/i18n/i18n";

function intlDateLocale(): string {
  const lng = (i18n.resolvedLanguage ?? i18n.language ?? "en").split("-")[0];
  if (lng === "ar") return "ar-SA";
  if (lng === "he") return "he-IL";
  return "en-GB";
}

export function formatNotificationTime(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(intlDateLocale(), {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

export function formatNotificationSectionDateLabel(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(intlDateLocale(), { weekday: "long", day: "numeric", month: "long" });
  } catch {
    return "";
  }
}

/** Date/time for tracking / debug readouts — follows current app language. */
export function formatLocaleDateTimeMs(ms: number): string {
  try {
    return new Date(ms).toLocaleString(intlDateLocale());
  } catch {
    return "";
  }
}
