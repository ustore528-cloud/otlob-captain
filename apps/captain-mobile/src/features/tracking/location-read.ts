import * as Location from "expo-location";
import type { UpdateCaptainLocationBody } from "@/services/api/dto";
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

/** قراءة مع حقول الإرسال للخادم (دقة أعلى عند دورة التتبع كل 3 ثوانٍ). */
export async function readCurrentPositionForTracking(): Promise<UpdateCaptainLocationBody> {
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  const { latitude, longitude, heading, speed, accuracy } = pos.coords;
  const nowMs = typeof pos.timestamp === "number" ? pos.timestamp : Date.now();
  return {
    latitude,
    longitude,
    heading: Number.isFinite(heading) ? heading : null,
    speed: Number.isFinite(speed) ? speed : null,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    timestamp: new Date(nowMs).toISOString(),
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
