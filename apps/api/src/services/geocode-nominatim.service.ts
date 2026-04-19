import { AppError } from "../utils/errors.js";

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";

/** يتوافق مع سياسة الاستخدام: تعريف تطبيق واضح (لا بريد عام). */
const USER_AGENT = "OtlobCaptain-AdminDashboard/1.0 (internal geocode; not a bot farm)";

type NominatimHit = {
  lat: string;
  lon: string;
  boundingbox?: string[];
  display_name: string;
};

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

  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", q);
  url.searchParams.set("addressdetails", "0");

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
  const lat = Number.parseFloat(hit.lat);
  const lon = Number.parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new AppError(502, "بيانات غير صالحة من خدمة تحديد الموقع.", "GEOCODE_PARSE");
  }

  let zoom = 11;
  if (hit.boundingbox && hit.boundingbox.length >= 4) {
    zoom = zoomFromBoundingBox(hit.boundingbox);
  } else {
    if (t && !c) zoom = 12;
    else if (c && !t) zoom = 6;
  }

  return {
    lat,
    lng: lon,
    zoom,
    displayName: hit.display_name,
    query: q,
  };
}
