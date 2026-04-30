import { AppError } from "../utils/errors.js";

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";

/** يتوافق مع سياسة الاستخدام: تعريف تطبيق واضح (لا بريد عام). */
const USER_AGENT = "OtlobCaptain-AdminDashboard/1.0 (internal geocode; not a bot farm)";

type NominatimHit = {
  lat: string;
  lon: string;
  boundingbox?: string[];
  display_name: string;
};

const IL = { south: 29.42, north: 33.52, west: 34.12, east: 35.92 };
function clampIl(lat: number, lon: number) {
  return {
    lat: Math.min(IL.north, Math.max(IL.south, lat)),
    lon: Math.min(IL.east, Math.max(IL.west, lon)),
  };
}

function zoomFromBoundingBox(bb: string[]): number {
  if (bb.length < 4) return 11;
  const minLat = Number.parseFloat(bb[0]!);
  const maxLat = Number.parseFloat(bb[1]!);
  const minLon = Number.parseFloat(bb[2]!);
  const maxLon = Number.parseFloat(bb[3]!);
  const latSpan = Math.max(Math.abs(maxLat - minLat), 1e-8);
  const lonSpan = Math.max(Math.abs(maxLon - minLon), 1e-8);
  const maxSpan = Math.max(latSpan, lonSpan, 0.0001);
  const z = Math.log2(360 / maxSpan) - 0.75;
  return Math.max(4, Math.min(16, Math.round(z)));
}

/**
 * نقطة واحدة من بحث Nominatim مع تحديد أفقي داخل تقريب المنطقة (نفس المنطق السابق للوحة المناطق الإدارية).
 */
async function nominatimSearchSingle(q: string): Promise<{
  lat: number;
  lng: number;
  displayName: string;
  boundingbox?: string[];
}> {
  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", q);
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("countrycodes", "il");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
  } catch {
    throw new AppError(502, "تعذر الاتصال بخدمة تحديد الموقع.", "GEOCODE_UPSTREAM");
  }

  if (res.status === 429) {
    throw new AppError(429, "خدمة البحث الجغرافي مشغولة — حاول بعد قليل.", "GEOCODE_RATE_LIMIT");
  }

  if (!res.ok) {
    throw new AppError(502, "رد غير متوقع من خدمة تحديد الموقع.", "GEOCODE_UPSTREAM");
  }

  const data = (await res.json()) as NominatimHit[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new AppError(
      404,
      "لم يُعثر على موقع مطابق. جرّب أسماء أخرى، أو حرّك الخريطة يدوياً.",
      "GEOCODE_NOT_FOUND",
    );
  }

  const hit = data[0]!;
  const latRaw = Number.parseFloat(hit.lat);
  const lonRaw = Number.parseFloat(hit.lon);
  if (!Number.isFinite(latRaw) || !Number.isFinite(lonRaw)) {
    throw new AppError(502, "بيانات غير صالحة من خدمة تحديد الموقع.", "GEOCODE_PARSE");
  }
  const { lat, lon } = clampIl(latRaw, lonRaw);
  return {
    lat,
    lng: lon,
    displayName: hit.display_name,
    boundingbox: hit.boundingbox,
  };
}

/** سطر عنوان حر واحد إلى إحداثيات — لتقدير رسوم مسافة بين استلام وتسليم نصَّين بدون نقاط مخزَّنة للعميل. */
export async function forwardGeocodeAddressLine(addressLine: string): Promise<{ lat: number; lng: number; displayName: string }> {
  const trimmed = addressLine.trim();
  if (!trimmed || trimmed.length < 4) {
    throw new AppError(
      400,
      "عنوان الاستلام أو التسليم قصير جداً لحساب رسوم التوصيل حسب المسافة. أضف عنواناً أوضح.",
      "BAD_ADDRESS_SHORT",
    );
  }
  const geo = await nominatimSearchSingle(trimmed);
  return { lat: geo.lat, lng: geo.lng, displayName: geo.displayName };
}

/**
 * ترجمة نص حر (مدينة، دولة، أو الاثنين) إلى إحداثيات عبر Nominatim.
 * يُستدعى من الخادم فقط لتفادي CORS ولإرسال User-Agent صالح.
 */
export async function geocodePlaceFromParts(country: string | undefined, city: string | undefined) {
  const c = country?.trim() ?? "";
  const t = city?.trim() ?? "";
  if (!c && !t) {
    throw new AppError(400, "أدخل دولة أو مدينة أو كليهما.", "BAD_REQUEST");
  }

  const parts = [t, c].filter(Boolean);
  const q = parts.join(", ");

  const geo = await nominatimSearchSingle(q);

  let zoom = 11;
  const hitBb = geo.boundingbox;
  if (hitBb && hitBb.length >= 4) {
    zoom = zoomFromBoundingBox(hitBb);
  } else {
    if (t && !c) zoom = 12;
    else if (c && !t) zoom = 6;
  }

  return {
    lat: geo.lat,
    lng: geo.lng,
    zoom,
    displayName: geo.displayName,
    query: q,
  };
}

type NominatimReversePayload = {
  display_name?: string;
  lat?: string;
  lon?: string;
  error?: string;
};

/**
 * تحويل إحداثيات إلى عنوان نصي (عرض شامل) عبر Nominatim Reverse — يُستدعى من الخادم فقط (CORS + User‑Agent).
 */
export async function reverseGeocodeFromLatLng(latIn: number, lngIn: number) {
  if (!Number.isFinite(latIn) || !Number.isFinite(lngIn)) {
    throw new AppError(400, "إحداثيات غير صالحة.", "BAD_COORDINATES");
  }
  if (latIn < -90 || latIn > 90 || lngIn < -180 || lngIn > 180) {
    throw new AppError(400, "إحداثيات خارج النطاق.", "COORDINATES_RANGE");
  }

  const url = new URL(NOMINATIM_REVERSE);
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(latIn));
  url.searchParams.set("lon", String(lngIn));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
  } catch {
    throw new AppError(502, "تعذر الاتصال بخدمة العنوان.", "GEOCODE_UPSTREAM");
  }

  if (res.status === 429) {
    throw new AppError(429, "خدمة العنوان مشغولة — حاول بعد قليل.", "GEOCODE_RATE_LIMIT");
  }

  if (!res.ok) {
    throw new AppError(502, "رد غير متوقع من خدمة العنوان.", "GEOCODE_UPSTREAM");
  }

  const data = (await res.json()) as NominatimReversePayload;
  if (data.error && String(data.error).trim() !== "") {
    throw new AppError(404, "لم يُعثر على عنوان لهذه النقطة.", "GEOCODE_NOT_FOUND");
  }

  const displayName = typeof data.display_name === "string" ? data.display_name.trim() : "";
  if (!displayName) {
    throw new AppError(404, "لم يُعثر على عنوان لهذه النقطة.", "GEOCODE_NOT_FOUND");
  }

  const latParsed = data.lat != null ? Number.parseFloat(String(data.lat)) : latIn;
  const lngParsed = data.lon != null ? Number.parseFloat(String(data.lon)) : lngIn;

  return {
    lat: Number.isFinite(latParsed) ? latParsed : latIn,
    lng: Number.isFinite(lngParsed) ? lngParsed : lngIn,
    displayName,
  };
}
