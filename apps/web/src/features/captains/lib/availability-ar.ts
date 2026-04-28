import i18n from "@/i18n/i18n";

/** Captain availability label for UI (server enum stays unchanged). */
export function availabilityAr(s: string): string {
  return i18n.t(`statuses.captain.${s}`, { defaultValue: s });
}
