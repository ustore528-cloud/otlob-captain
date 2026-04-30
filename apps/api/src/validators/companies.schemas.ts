import { z } from "zod";

const DeliveryPricingModeSchema = z.union([z.literal("FIXED"), z.literal("DISTANCE_BASED")]);
const DeliveryFeeRoundingModeSchema = z.union([z.literal("CEIL"), z.literal("ROUND"), z.literal("NONE")]);

const CompanyDeliveryPricingSchema = z
  .object({
    deliveryPricingMode: DeliveryPricingModeSchema,
    fixedDeliveryFee: z.coerce.number().nonnegative().optional(),
    baseDeliveryFee: z.coerce.number().nonnegative().optional(),
    pricePerKm: z.coerce.number().nonnegative().optional(),
    deliveryFeeRoundingMode: DeliveryFeeRoundingModeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryPricingMode === "FIXED") {
      if (data.fixedDeliveryFee == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fixedDeliveryFee"],
          message: "fixedDeliveryFee is required when deliveryPricingMode is FIXED",
        });
      }
      return;
    }
    if (data.baseDeliveryFee == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baseDeliveryFee"],
        message: "baseDeliveryFee is required when deliveryPricingMode is DISTANCE_BASED",
      });
    }
    if (data.pricePerKm == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pricePerKm"],
        message: "pricePerKm is required when deliveryPricingMode is DISTANCE_BASED",
      });
    }
  });

export const CompanyIdParamSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
});

/** إنشاء شركة — السوبر أدمن فقط؛ اسم فقط في الطور الحالي */
export const CreateCompanyBodySchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(200),
    incubatorMotherName: z.string().trim().max(200).optional(),
    deliveryPricing: CompanyDeliveryPricingSchema,
  })
  .strict();

export const UpdateCompanyBodySchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(200).optional(),
    incubatorMotherName: z.string().trim().max(200).nullable().optional(),
    deliveryPricing: CompanyDeliveryPricingSchema.optional(),
  })
  .strict();

/** Body optional so idempotent `alreadyArchived` can use empty POST; service validates when company is still active. */
export const CompanyArchiveBodySchema = z
  .object({
    confirmPhrase: z.string().optional(),
  })
  .strict();
