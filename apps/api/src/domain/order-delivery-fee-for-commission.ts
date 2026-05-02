import { Prisma } from "@prisma/client";
import { money } from "../services/ledger/money.js";

const ZERO = money(0);

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

/** Effective platform commission % (captain override vs dashboard default). */
export function resolveEffectivePlatformCommissionPercent(input: {
  prepaidAllowCaptainCustomCommission: boolean;
  prepaidDefaultCommissionPercent: Prisma.Decimal.Value;
  captainCommissionPercentOverride: Prisma.Decimal | null;
}): Prisma.Decimal {
  const useCustom =
    input.prepaidAllowCaptainCustomCommission && input.captainCommissionPercentOverride != null;
  return money(useCustom ? input.captainCommissionPercentOverride! : input.prepaidDefaultCommissionPercent);
}

/**
 * Split of delivery fee after DELIVERED: platform %, fixed captain net share, deduction from captain prepaid,
 * and company profit (remainder after platform share of the deduction bucket).
 * Uses **delivery fee only** — order amount is ignored here (caller passes resolved fee).
 */
export function resolveDeliverySettlementFromDeliveryFee(input: {
  deliveryFee: Prisma.Decimal.Value;
  platformCommissionPercent: Prisma.Decimal.Value;
  captainFixedSharePerDelivery: Prisma.Decimal.Value;
}): {
  deliveryFee: Prisma.Decimal;
  platformCommission: Prisma.Decimal;
  captainNetShare: Prisma.Decimal;
  captainBalanceDeduction: Prisma.Decimal;
  companyProfit: Prisma.Decimal;
} {
  const df = money(input.deliveryFee);
  const pct = money(input.platformCommissionPercent);
  const platformCommission = money(df.mul(pct).div(100));
  const captainNetShare = money(input.captainFixedSharePerDelivery);
  let captainBalanceDeduction = money(df.minus(captainNetShare));
  if (captainBalanceDeduction.lt(ZERO)) captainBalanceDeduction = ZERO;
  const companyProfit = money(captainBalanceDeduction.minus(platformCommission));
  return {
    deliveryFee: df,
    platformCommission,
    captainNetShare,
    captainBalanceDeduction,
    companyProfit,
  };
}
