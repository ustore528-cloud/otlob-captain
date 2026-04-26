import { OrderStatus, type Prisma } from "@prisma/client";

type OrderTimestampSlice = {
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
};

/**
 * Sets `picked_up_at` / `delivered_at` once on the first transition into PICKED_UP / DELIVERED.
 * Does not overwrite existing values (e.g. after a mistaken admin edit or later row updates).
 */
export function patchOrderStatusTransitionTimestamps(
  current: OrderTimestampSlice,
  newStatus: OrderStatus,
  now: Date = new Date(),
): Pick<Prisma.OrderUpdateInput, "pickedUpAt" | "deliveredAt"> {
  const out: Pick<Prisma.OrderUpdateInput, "pickedUpAt" | "deliveredAt"> = {};
  if (newStatus === OrderStatus.PICKED_UP && current.pickedUpAt == null) {
    out.pickedUpAt = now;
  }
  if (newStatus === OrderStatus.DELIVERED && current.deliveredAt == null) {
    out.deliveredAt = now;
  }
  return out;
}
