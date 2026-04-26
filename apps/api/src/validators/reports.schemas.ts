import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { PaginationQuerySchema } from "./pagination.schemas.js";

const isoInstant = z.string().min(1);

/** `from` / `to` — UTC instants; max 90 days enforced in `reportsService`. */
export const ReportsDateRangeQuerySchema = z.object({
  from: isoInstant,
  to: isoInstant,
});

export const DeliveredCommissionsQuerySchema = PaginationQuerySchema.extend({
  from: isoInstant,
  to: isoInstant,
});

export const OrdersHistoryQuerySchema = PaginationQuerySchema.extend({
  from: isoInstant,
  to: isoInstant,
  captainId: z.string().cuid().optional(),
  storeId: z.string().cuid().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
});
