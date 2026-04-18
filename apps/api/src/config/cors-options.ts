import { env } from "./env.js";

/** لوحة الويب على Vercel — تُدمج مع `CORS_ORIGIN` دائمًا (بدون تكرار). */
const WEB_DASHBOARD_ORIGIN = "https://my-project-web-azure.vercel.app";

/** للويب والموبايل: إذا وُجد `*` في القائمة يُعاد `true` (يعكس origin الطلب). */
export function resolveCorsOrigin(): boolean | string[] {
  const origins = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
  if (origins.includes("*")) return true;
  const merged = [...origins, WEB_DASHBOARD_ORIGIN];
  return [...new Set(merged)];
}
