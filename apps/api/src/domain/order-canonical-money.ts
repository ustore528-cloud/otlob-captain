import { Prisma } from "@prisma/client";
import { AppError } from "../utils/errors.js";

const ROUND = Prisma.Decimal.ROUND_HALF_UP;

/** Two-decimal money for order line items (ILS-style half-up). */
export function orderMoneyDec(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2, ROUND);
}

export type CanonicalOrderMoneyInput = {
  amount: number;
  deliveryFee?: number | null;
  cashCollection?: number | null;
};

export type CanonicalOrderMoneyResult = {
  amount: Prisma.Decimal;
  deliveryFee: Prisma.Decimal;
  cashCollection: Prisma.Decimal;
};

/**
 * Resolves persisted `amount`, `delivery_fee`, and `cash_collection` for order create.
 *
 * Canonical invariant: **cash_collection = amount + delivery_fee** (after rounding).
 *
 * Backward compatibility: if `deliveryFee` is omitted but `cashCollection` is provided,
 * **delivery_fee** is derived as **cash_collection − amount** (must be ≥ 0).
 * If both `deliveryFee` and `cashCollection` are omitted, **delivery_fee = 0** and
 * **cash_collection = amount**.
 */
export function resolveCanonicalOrderMoneyOnCreate(input: CanonicalOrderMoneyInput): CanonicalOrderMoneyResult {
  const amount = orderMoneyDec(input.amount);
  const hasCash = input.cashCollection !== undefined && input.cashCollection !== null;
  const hasFee = input.deliveryFee !== undefined && input.deliveryFee !== null;

  let deliveryFee: Prisma.Decimal;
  if (hasFee) {
    deliveryFee = orderMoneyDec(input.deliveryFee as number);
  } else if (hasCash) {
    const cashDec = orderMoneyDec(input.cashCollection as number);
    deliveryFee = orderMoneyDec(cashDec.minus(amount));
    if (deliveryFee.lt(0)) {
      throw new AppError(
        400,
        "cash_collection cannot be less than amount. Required: cash_collection = amount + delivery_fee.",
        "ORDER_MONEY_INVALID",
      );
    }
  } else {
    deliveryFee = orderMoneyDec(0);
  }

  let cashCollection: Prisma.Decimal;
  if (hasCash) {
    cashCollection = orderMoneyDec(input.cashCollection as number);
    const expected = orderMoneyDec(amount.plus(deliveryFee));
    if (!cashCollection.equals(expected)) {
      throw new AppError(
        400,
        `cash_collection must equal amount + delivery_fee (expected ${expected.toFixed(2)}, got ${cashCollection.toFixed(2)}).`,
        "ORDER_MONEY_INVARIANT",
      );
    }
  } else {
    cashCollection = orderMoneyDec(amount.plus(deliveryFee));
  }

  return { amount, deliveryFee, cashCollection };
}
