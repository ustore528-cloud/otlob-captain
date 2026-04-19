import type { DashboardSettingsDto } from "@/types/api";

/** الرياض — نفس القيمة السابقة قبل إعدادات الخادم. */
export const DISTRIBUTION_MAP_FALLBACK_CENTER: [number, number] = [24.7136, 46.6753];
export const DISTRIBUTION_MAP_FALLBACK_ZOOM = 11;

export function resolveDashboardMapView(
  settings: Pick<DashboardSettingsDto, "mapDefaultLat" | "mapDefaultLng" | "mapDefaultZoom"> | null | undefined,
): { center: [number, number]; zoom: number } {
  const lat = settings?.mapDefaultLat;
  const lng = settings?.mapDefaultLng;
  const z = settings?.mapDefaultZoom;
  if (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    typeof z === "number" &&
    Number.isInteger(z) &&
    z >= 1 &&
    z <= 19
  ) {
    return { center: [lat, lng], zoom: z };
  }
  return { center: [...DISTRIBUTION_MAP_FALLBACK_CENTER], zoom: DISTRIBUTION_MAP_FALLBACK_ZOOM };
}
