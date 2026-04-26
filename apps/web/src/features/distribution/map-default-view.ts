import type { DashboardSettingsDto } from "@/types/api";
import {
  clampLatLngPair,
  ISRAEL_MAP_DEFAULT_CENTER,
  ISRAEL_MAP_DEFAULT_ZOOM,
} from "@/lib/israel-map-bounds";

/** مركز افتراضي عند غياب إعدادات الخادم — إسرائيل */
export const DISTRIBUTION_MAP_FALLBACK_CENTER: [number, number] = [...ISRAEL_MAP_DEFAULT_CENTER];
export const DISTRIBUTION_MAP_FALLBACK_ZOOM = ISRAEL_MAP_DEFAULT_ZOOM;

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
    return { center: clampLatLngPair([lat, lng]), zoom: z };
  }
  return { center: [...ISRAEL_MAP_DEFAULT_CENTER], zoom: ISRAEL_MAP_DEFAULT_ZOOM };
}
