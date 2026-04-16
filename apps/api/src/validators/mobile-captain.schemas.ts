import { z } from "zod";
import { CaptainAvailabilityStatus, OrderStatus } from "@prisma/client";
import { PaginationQuerySchema } from "./pagination.schemas.js";

export const MobileCaptainLoginBodySchema = z.object({
  phone: z.string().min(5).max(32),
  password: z.string().min(1),
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
