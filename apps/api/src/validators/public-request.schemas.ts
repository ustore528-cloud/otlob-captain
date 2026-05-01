import { z } from "zod";
import { DistributionMode } from "@prisma/client";
import { isReasonableFlexiblePhone } from "@captain/shared";
import { StoreIdSchema } from "./stores.schemas.js";

const ownerCodeParam = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid owner code");

export const PublicRequestContextParamSchema = z.object({
  code: ownerCodeParam,
});

export const PublicNearbyCaptainsParamsSchema = z.object({
  code: ownerCodeParam,
});

export const PublicNearbyCaptainsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(2).max(25).optional(),
});

export const PublicOrderTrackingParamsSchema = z.object({
  ownerCode: ownerCodeParam,
  orderId: z.string().min(16).max(128),
});

/** Public tracking tokens match `orders.public_tracking_token` @db.VarChar(64) (typically UUID strings). */
const publicTrackingTokenValue = z.string().min(16).max(64);

export const PublicOrderTrackingQuerySchema = z.object({
  token: publicTrackingTokenValue,
});

export const PublicOrderByTrackingTokenParamsSchema = z.object({
  trackingToken: publicTrackingTokenValue,
});

const pushSubscriptionInnerSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(16).max(2048),
    auth: z.string().min(8).max(256),
  }),
});

export const PublicWebPushSubscribeBodySchema = z.object({
  ownerCode: ownerCodeParam,
  orderId: z.string().min(16).max(128),
  trackingToken: publicTrackingTokenValue,
  locale: z.enum(["ar", "en", "he"]).optional(),
  userAgent: z.string().max(4096).optional(),
  platform: z.string().max(128).optional(),
  subscription: pushSubscriptionInnerSchema,
});

export const PublicWebPushSubscribeByTokenParamsSchema = z.object({
  trackingToken: publicTrackingTokenValue,
});

export const PublicWebPushSubscribeByTokenBodySchema = z.object({
  locale: z.enum(["ar", "en", "he"]).optional(),
  userAgent: z.string().max(4096).optional(),
  platform: z.string().max(128).optional(),
  subscription: pushSubscriptionInnerSchema,
});

/** Same money rules as `CreateOrderBodySchema` — enforced in `ordersService.create`. */
export const PublicCreateOrderBodySchema = z
  .object({
    ownerCode: ownerCodeParam,
    storeId: StoreIdSchema.optional(),
    /** Recipient / delivery contact */
    customerName: z.string().min(1).max(200),
    customerPhone: z.string().min(1).max(32),
    senderFullName: z.string().min(1).max(200),
    senderPhone: z.string().min(1).max(32),
    pickupAddress: z.string().min(1).max(500),
    dropoffAddress: z.string().min(1).max(500),
    area: z.string().min(1).max(200),
    amount: z.coerce.number().nonnegative(),
    /** Customer collection; optional — server computes `amount + delivery_fee` when omitted. */
    cashCollection: z.coerce.number().nonnegative().optional(),
    pickupLatitude: z.number().min(-90).max(90).optional(),
    pickupLongitude: z.number().min(-180).max(180).optional(),
    dropoffLatitude: z.number().min(-90).max(90).optional(),
    dropoffLongitude: z.number().min(-180).max(180).optional(),
    notes: z.string().max(2000).optional(),
    distributionMode: z.nativeEnum(DistributionMode).optional(),
    zoneId: z.string().cuid().optional(),
  })
  .superRefine((body, ctx) => {
    if (!isReasonableFlexiblePhone(body.customerPhone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "INVALID_CUSTOMER_PHONE",
        path: ["customerPhone"],
      });
    }
    if (!isReasonableFlexiblePhone(body.senderPhone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "INVALID_SENDER_PHONE",
        path: ["senderPhone"],
      });
    }
  });
