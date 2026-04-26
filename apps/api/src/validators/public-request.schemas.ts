import { z } from "zod";
import { DistributionMode } from "@prisma/client";
import { StoreIdSchema } from "./stores.schemas.js";

const ownerCodeParam = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid owner code");

export const PublicRequestContextParamSchema = z.object({
  code: ownerCodeParam,
});

/** Same money rules as `CreateOrderBodySchema` — enforced in `ordersService.create`. */
export const PublicCreateOrderBodySchema = z.object({
  ownerCode: ownerCodeParam,
  storeId: StoreIdSchema.optional(),
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().min(5).max(32),
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
  /** Delivery fee (may be **0**). */
  deliveryFee: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
  distributionMode: z.nativeEnum(DistributionMode).optional(),
  zoneId: z.string().cuid().optional(),
});
