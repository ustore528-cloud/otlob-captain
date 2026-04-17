export function formatLastSeenAr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return null;
  }
}

export function formatNotificationTime(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ar-SA", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}
