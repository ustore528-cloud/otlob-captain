import { z } from "zod";

/** تحديث جزئي لإعدادات اللوحة — الحقول الناقصة لا تُغيّر القيم المخزّنة. */
export const DashboardSettingsPatchSchema = z
  .object({
    mapCountry: z.union([z.string().max(160).trim(), z.literal(""), z.null()]).optional(),
    mapCityRegion: z.union([z.string().max(200).trim(), z.literal(""), z.null()]).optional(),
    mapDefaultLat: z.union([z.number().finite().min(-90).max(90), z.null()]).optional(),
    mapDefaultLng: z.union([z.number().finite().min(-180).max(180), z.null()]).optional(),
    mapDefaultZoom: z.union([z.number().int().min(1).max(19), z.null()]).optional(),
  })
  .strict();

export type DashboardSettingsPatchBody = z.infer<typeof DashboardSettingsPatchSchema>;
