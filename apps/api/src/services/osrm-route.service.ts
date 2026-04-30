/** تقدير زمن القيادة (بالدقيقة) عبر OSRM (`OSRM_ROUTE_BASE_URL` أو خادم عام). */
export async function osrmDrivingDurationMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<number | null> {
  if (!Number.isFinite(from.lat) || !Number.isFinite(from.lng) || !Number.isFinite(to.lat) || !Number.isFinite(to.lng)) {
    return null;
  }
  const base = (process.env.OSRM_ROUTE_BASE_URL ?? "https://router.project-osrm.org").replace(/\/+$/, "");
  const url = `${base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  const ctl = AbortSignal.timeout(8000);
  try {
    const res = await fetch(url, { signal: ctl });
    if (!res.ok) return null;
    const json = (await res.json()) as { routes?: Array<{ duration?: number }> };
    const sec = json.routes?.[0]?.duration;
    if (!Number.isFinite(sec)) return null;
    return Math.max(1, Math.round(sec! / 60));
  } catch {
    return null;
  }
}
