import { z } from "zod";

function queryString(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const s = Array.isArray(v) ? v[0] : String(v);
  const t = s.trim();
  return t === "" ? undefined : t;
}

/** بحث جغرافي بالدولة و/أو المدينة — يجب تمرير واحد على الأقل. */
export const GeocodePlaceQuerySchema = z
  .object({
    country: z.preprocess(queryString, z.string().max(160).optional()),
    city: z.preprocess(queryString, z.string().max(200).optional()),
  })
  .refine((d) => Boolean(d.country || d.city), {
    message: "country_or_city_required",
  });
