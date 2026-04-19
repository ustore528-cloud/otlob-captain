import { env } from "./env.js";

/** لوحة الويب على Vercel — تُدمج مع `CORS_ORIGIN` دائمًا (بدون تكرار). */
const WEB_DASHBOARD_ORIGIN = "https://my-project-web-azure.vercel.app";

/**
 * أصول شائعة لتطوير Expo Web / Metro / Vite محليًا (Captain mobile + لوحة).
 * تُضاف إلى القائمة حتى يعمل الطلب من LAN إلى API على Railway أثناء التطوير.
 */
const EXPO_AND_LOCAL_DEV_ORIGINS = [
  "http://192.168.55.121:8082",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:8082",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const;

/**
 * عند تشغيل الـ API محليًا بـ NODE_ENV=development: السماح بأي أصل http(s) على شبكات LAN الخاصة
 * (مفيد إذا تغيّر IP الجهاز دون إعادة نشر القائمة الثابتة).
 */
export function isPrivateLanDevOrigin(origin: string): boolean {
  if (env.NODE_ENV !== "development") return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

/** للويب والموبايل: إذا وُجد `*` في القائمة يُعاد `true` (يعكس origin الطلب). */
export function resolveCorsOrigin(): boolean | string[] {
  const origins = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
  if (origins.includes("*")) return true;
  const merged = [...origins, WEB_DASHBOARD_ORIGIN, ...EXPO_AND_LOCAL_DEV_ORIGINS];
  return [...new Set(merged)];
}
