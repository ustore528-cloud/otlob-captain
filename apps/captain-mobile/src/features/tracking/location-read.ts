import * as Location from "expo-location";
import i18n from "@/i18n/i18n";

/**
 * قراءة موقع حالي — دقة متوازنة للبطارية.
 */
export async function readCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  };
}

export function formatLocationError(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    const code = String((e as { code?: string }).code ?? "");
    if (code === "E_LOCATION_UNAVAILABLE") return i18n.t("tracking.errorGpsUnavailable");
  }
  if (e instanceof Error && e.message.trim()) {
    return i18n.t("tracking.errorLocationWithDetail", { detail: e.message });
  }
  return i18n.t("tracking.errorLocationUnknown");
}
