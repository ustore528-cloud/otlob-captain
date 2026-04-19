import { ApiError, apiFetch } from "@/lib/api/http";

/** Must match API `GET /api/v1/geocode/place` (kept local so builds do not depend on a separate routes module in the repo snapshot). */
const GEOCODE_PLACE_PATH = "/api/v1/geocode/place" as const;

export type GeocodePlaceResult = {
  lat: number;
  lng: number;
  zoom: number;
  displayName: string;
  query: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseGeocodePlacePayload(data: unknown): GeocodePlaceResult {
  if (!isRecord(data)) {
    throw new ApiError("استجابة غير صالحة من خادم تحديد الموقع.", 502, "GEOCODE_BAD_SHAPE");
  }
  const lat = typeof data.lat === "number" ? data.lat : Number(data.lat);
  const lng = typeof data.lng === "number" ? data.lng : Number(data.lng);
  const zoom = typeof data.zoom === "number" ? data.zoom : Number.parseInt(String(data.zoom), 10);
  const displayName = typeof data.displayName === "string" ? data.displayName : "";
  const query = typeof data.query === "string" ? data.query : "";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) {
    throw new ApiError("بيانات إحداثيات ناقصة من الخادم.", 502, "GEOCODE_BAD_FIELDS");
  }
  return {
    lat,
    lng,
    zoom: Math.max(1, Math.min(19, Math.round(zoom))),
    displayName: displayName || query || "—",
    query,
  };
}

export function geocodePlace(
  token: string,
  params: { country?: string | null; city?: string | null },
): Promise<GeocodePlaceResult> {
  const p = new URLSearchParams();
  const country = params.country?.trim();
  const city = params.city?.trim();
  if (country) p.set("country", country);
  if (city) p.set("city", city);
  const qs = p.toString();
  const url = `${GEOCODE_PLACE_PATH}${qs ? `?${qs}` : ""}`;
  return apiFetch<unknown>(url, { token }).then(parseGeocodePlacePayload);
}
