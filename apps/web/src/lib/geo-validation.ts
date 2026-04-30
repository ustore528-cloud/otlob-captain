/** هل الزوج lat/lng رقمين محدَّدين ضمن مدى الويات؟ يُستخدم قبل استدعاءات nearby-captains. */
export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  const latNum =
    typeof lat === "string" ? Number(lat.trim()) : typeof lat === "number" ? lat : Number(lat);
  const lngNum =
    typeof lng === "string" ? Number(lng.trim()) : typeof lng === "number" ? lng : Number(lng);
  return (
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180
  );
}
