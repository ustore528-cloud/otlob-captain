import { Prisma } from "@prisma/client";
import { money } from "../services/ledger/money.js";

/** Minimal order slice needed to resolve the commission base (delivery fee only). */
export type OrderSliceForDeliveryFeeCommission = {
  amount: Prisma.Decimal;
  deliveryFee: Prisma.Decimal | null;
  cashCollection: Prisma.Decimal;
};

/**
 * **Commission / prepaid base:** the delivery fee only — never `cash_collection` when it is
 * the full customer total (`amount + delivery_fee`).
 *
 * - If `delivery_fee` is stored (including `0`), use it (rounded to cents).
 * - If `delivery_fee` is null (legacy rows), derive:
 *   `max(0, cash_collection − amount)` (same rounding).
 */
export function resolveDeliveryFeeForCommission(order: OrderSliceForDeliveryFeeCommission): Prisma.Decimal {
  if (order.deliveryFee != null) {
    return money(order.deliveryFee);
  }
  const derived = money(order.cashCollection).minus(money(order.amount));
  if (derived.lte(0)) return money(0);
  return money(derived);
}
