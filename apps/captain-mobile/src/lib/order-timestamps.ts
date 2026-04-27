/** Display order/log times with Western digits (en-GB) regardless of UI language. */
const DISPLAY_LOCALE = "en-GB" as const;

export function formatOrderEventTime(iso: string | null | undefined, notRecorded: string): string {
  if (!iso || !String(iso).trim()) return notRecorded;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return notRecorded;
    return d.toLocaleString(DISPLAY_LOCALE, { dateStyle: "medium", timeStyle: "short", hour12: false });
  } catch {
    return notRecorded;
  }
}

export function formatLogTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(DISPLAY_LOCALE, { dateStyle: "medium", timeStyle: "short", hour12: false });
  } catch {
    return null;
  }
}
