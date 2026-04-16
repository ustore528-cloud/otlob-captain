import { env } from "./env.js";

/** للويب والموبايل: إذا وُجد `*` في القائمة يُعاد `true` (يعكس origin الطلب). */
export function resolveCorsOrigin(): boolean | string[] {
  const origins = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
  if (origins.includes("*")) return true;
  return origins;
}
