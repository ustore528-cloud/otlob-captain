import { z } from "zod";
import { CaptainAvailabilityStatus, OrderStatus } from "@prisma/client";
import { PaginationQuerySchema } from "./pagination.schemas.js";

export const MobileCaptainLoginBodySchema = z
  .object({
    phone: z.string().min(5).max(32).optional(),
    email: z.string().email().optional(),
    password: z.string().min(1),
  })
  .refine((d) => Boolean(d.phone?.trim() || d.email?.trim()), {
    message: "phone_or_email_required",
    path: ["phone"],
  });

export const MobileCaptainRefreshBodySchema = z.object({
  refreshToken: z.string().min(10),
});

export const MobileCaptainOrderIdParamSchema = z.object({
  orderId: z.string().cuid(),
});

/** حالات مسموح بها في جسم PATCH لتطبيق الكابتن (بعد القبول). */
export const MobileCaptainOrderStatusBodySchema = z.object({
  status: z.union([
    z.literal(OrderStatus.PICKED_UP),
    z.literal(OrderStatus.IN_TRANSIT),
    z.literal(OrderStatus.DELIVERED),
  ]),
});

export const MobileCaptainOrderHistoryQuerySchema = PaginationQuerySchema.extend({
  status: z.nativeEnum(OrderStatus).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const MobileCaptainEarningsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const MobileCaptainAvailabilityBodySchema = z.object({
  availabilityStatus: z.nativeEnum(CaptainAvailabilityStatus),
});

export const MobileCaptainPushTokenBodySchema = z.object({
  token: z.string().min(20).max(300),
  platform: z.union([z.literal("android"), z.literal("ios")]),
  appVersion: z.string().max(40).nullable().optional(),
  language: z.union([z.literal("ar"), z.literal("en"), z.literal("he")]).nullable().optional(),
});

/** Optional feedback when a captain self-deactivates their account. */
export const MobileCaptainDeleteAccountBodySchema = z.preprocess(
  (raw) => (raw == null || typeof raw !== "object" ? {} : raw),
  z.object({
    reason: z.string().max(2000).nullable().optional(),
  }),
);
