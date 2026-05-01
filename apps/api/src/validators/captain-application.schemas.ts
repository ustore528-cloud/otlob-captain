import {
  CaptainApplicationAvailability,
  CaptainApplicationStatus,
} from "@prisma/client";
import { z } from "zod";

export const CaptainApplicationStatusSchema = z.nativeEnum(CaptainApplicationStatus);
export const CaptainApplicationAvailabilitySchema = z.nativeEnum(CaptainApplicationAvailability);

const languageItem = z
  .string()
  .trim()
  .min(1)
  .max(64);

export const PublicCaptainApplicationCreateBodySchema = z
  .object({
    fullName: z.string().trim().min(2).max(200),
    primaryPhone: z.string().trim().min(8).max(32),
    whatsappPhone: z.string().trim().min(8).max(32),
    dateOfBirth: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null(), z.literal("")]).optional(),
    /** عمر بديل إن لم يُعرَف التاريخ بدقة — حقل معلوماتي */
    ageYears: z.union([z.number().int().min(16).max(90), z.null()]).optional(),
    city: z.string().trim().min(2).max(120),
    fullAddress: z.string().trim().min(8).max(4000),
    languagesSpoken: z.array(languageItem).min(1).max(24),
    vehicleType: z.string().trim().min(2).max(80),
    vehicleNumber: z.union([z.string().trim().min(2).max(64), z.null(), z.literal("")]).optional(),
    preferredWorkAreas: z.string().trim().min(2).max(4000),
    canEnterJerusalem: z.boolean(),
    canEnterInterior: z.boolean(),
    availability: CaptainApplicationAvailabilitySchema,
    notes: z.union([z.string().trim().max(4000), z.null(), z.literal("")]).optional(),
  })
  .superRefine((val, ctx) => {
    const hasDob = typeof val.dateOfBirth === "string" && val.dateOfBirth.length === 10;
    const age = typeof val.ageYears === "number" ? val.ageYears : null;
    if (!hasDob && age == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dateOfBirth or ageYears required",
        path: ["ageYears"],
      });
    }
  });

export type PublicCaptainApplicationCreateBody = z.infer<typeof PublicCaptainApplicationCreateBodySchema>;

export const AdminCaptainApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(40),
  status: z.union([CaptainApplicationStatusSchema, z.literal("ALL")]).optional(),
  q: z.string().trim().max(200).optional(),
});

export const AdminCaptainApplicationIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const AdminCaptainApplicationStatusBodySchema = z.object({
  status: CaptainApplicationStatusSchema,
  internalNotes: z.union([z.string().max(12000).nullable(), z.literal("")]).optional(),
});
