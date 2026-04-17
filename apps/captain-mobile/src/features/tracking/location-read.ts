import * as Location from "expo-location";

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
    if (code === "E_LOCATION_UNAVAILABLE") return "الموقع غير متاح حاليًا (GPS أو الشبكة).";
  }
  if (e instanceof Error) return e.message;
  return "تعذّر تحديد الموقع.";
}
