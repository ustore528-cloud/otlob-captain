import { OrderStatus } from "@prisma/client";
import { AppError } from "../utils/errors.js";

/** انتقالات مسموحة للكابتن المعيّن بعد قبول الطلب (مسار التسليم). */
const CAPTAIN_DELIVERY_CHAIN: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.ACCEPTED]: [OrderStatus.PICKED_UP],
  [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED],
};

export function assertCaptainOrderStatusTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) return;
  const allowed = CAPTAIN_DELIVERY_CHAIN[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AppError(
      409,
      `Captain cannot change status from ${from} to ${to}`,
      "INVALID_STATUS_TRANSITION",
    );
  }
}

export function allowedCaptainDeliveryTargets(from: OrderStatus): OrderStatus[] {
  return CAPTAIN_DELIVERY_CHAIN[from] ?? [];
}
