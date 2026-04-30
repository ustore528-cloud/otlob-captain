import type { ActiveMapCaptain } from "@/types/api";

export type CaptainMapVisualLabelKey = "WAITING_ACCEPT" | "ACTIVE_DELIVERY" | "RECENT_REJECT" | "AVAILABLE";
export const CAPTAIN_LOCATION_STALE_MS = 60_000;

export function isCaptainLocationStale(c: ActiveMapCaptain): boolean {
  const recordedAt = c.lastLocation?.recordedAt;
  if (!recordedAt) return true;
  const ts = new Date(recordedAt).getTime();
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > CAPTAIN_LOCATION_STALE_MS;
}

/** Priority for distribution map: waiting to accept → active delivery → recent reject → available */
export function captainMapVisual(c: ActiveMapCaptain): {
  border: string;
  bg: string;
  pulse: boolean;
  labelKey: CaptainMapVisualLabelKey;
} {
  if (c.waitingOffers > 0) {
    return {
      border: "#ca8a04",
      bg: "#fef9c3",
      pulse: true,
      labelKey: "WAITING_ACCEPT",
    };
  }
  if (c.activeOrders > 0) {
    return {
      border: "#15803d",
      bg: "#dcfce7",
      pulse: true,
      labelKey: "ACTIVE_DELIVERY",
    };
  }
  if (c.recentRejects > 0) {
    return {
      border: "#b91c1c",
      bg: "#fee2e2",
      pulse: true,
      labelKey: "RECENT_REJECT",
    };
  }
  return {
    border: "#2563eb",
    bg: "#dbeafe",
    pulse: false,
    labelKey: "AVAILABLE",
  };
}

/** متبقي من مهلة العرض (للعدّ على الخريطة أو لوحة الإفلات) */
export function assignmentOfferSecondsLeft(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}
