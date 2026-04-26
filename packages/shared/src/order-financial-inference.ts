/**
 * ## Canonical persisted model (`amount` + `delivery_fee` + `cash_collection`)
 *
 * The backend stores:
 * - **`amount`**: store / merchandise amount (مبلغ المتجر).
 * - **`delivery_fee`**: delivery fee only (may be **0** for free delivery).
 * - **`cash_collection`**: total amount to collect from the customer (**= amount + delivery_fee** after rounding).
 *
 * ## Legacy inference (read fallback only)
 *
 * Older rows may have **`delivery_fee` null**. For those, `inferLegacyOrderFinancialBreakdown`
 * keeps the previous residual behaviour from `amount` + `cash_collection` only.
 */

export type OrderFinancialDeliveryFeeSource = "inferred" | "explicit";

export type OrderFinancialBreakdownDto = {
  /** Store / merchandise line — same as order `amount`. */
  orderAmount: string;
  /** Delivery fee line — from persisted `delivery_fee` in canonical mode. */
  deliveryFee: string;
  /** Total due from the customer — same as order `cash_collection` in canonical mode. */
  customerTotal: string;
  /** Same as `orderAmount` today — amount payable to the store for the goods line. */
  payToStore: string;
  /** Not stored yet — reserved for future store payout / settlement. */
  storePayout: string | null;
  isCashOnDelivery: boolean;
  deliveryFeeSource: OrderFinancialDeliveryFeeSource;
};

function parseMoney(s: string): number {
  const n = parseFloat(String(s ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  return round2(n).toFixed(2);
}

const EPS = 0.005;

/**
 * Breakdown for orders that have persisted **`delivery_fee`** (including `0.00`).
 * Aligns UI with: **customerTotal ≈ amount + delivery_fee** (uses stored cash when within epsilon).
 */
export function inferCanonicalOrderFinancialBreakdown(
  amountStr: string,
  deliveryFeeStr: string,
  cashCollectionStr: string,
): OrderFinancialBreakdownDto {
  const store = round2(parseMoney(amountStr));
  const fee = round2(parseMoney(deliveryFeeStr));
  const expected = round2(store + fee);
  let customer = round2(parseMoney(cashCollectionStr));
  if (customer <= 0 && (store > 0 || fee > 0)) {
    customer = expected;
  } else if (fee > 0 && Math.abs(customer - expected) > EPS) {
    customer = expected;
  }
  return {
    orderAmount: fmt(store),
    deliveryFee: fmt(fee),
    customerTotal: fmt(customer),
    payToStore: fmt(store),
    storePayout: null,
    isCashOnDelivery: customer > store || fee > 0,
    deliveryFeeSource: "explicit",
  };
}

function computeLegacyOrderFinancialBreakdown(amountStr: string, cashCollectionStr: string): OrderFinancialBreakdownDto {
  const orderValue = round2(parseMoney(amountStr));
  const cash = round2(parseMoney(cashCollectionStr));

  if (cash > 0) {
    const customerTotal = cash;
    const deliveryFee = round2(Math.max(0, customerTotal - orderValue));
    return {
      orderAmount: fmt(orderValue),
      deliveryFee: fmt(deliveryFee),
      customerTotal: fmt(customerTotal),
      payToStore: fmt(orderValue),
      storePayout: null,
      isCashOnDelivery: true,
      deliveryFeeSource: "inferred",
    };
  }

  const t = orderValue;
  return {
    orderAmount: fmt(t),
    deliveryFee: fmt(0),
    customerTotal: fmt(t),
    payToStore: fmt(t),
    storePayout: null,
    isCashOnDelivery: false,
    deliveryFeeSource: "inferred",
  };
}

/**
 * Legacy read path when `delivery_fee` was never stored (older rows).
 * Treats `cash_collection` > 0 as COD customer total and infers fee as max(0, cash − amount).
 */
export function inferLegacyOrderFinancialBreakdown(amountStr: string, cashCollectionStr: string): OrderFinancialBreakdownDto {
  return computeLegacyOrderFinancialBreakdown(amountStr, cashCollectionStr);
}

export type InferOrderFinancialBreakdownOptions = {
  /** @deprecated No longer used; canonical rows use `inferCanonicalOrderFinancialBreakdown`. */
  explicitDeliveryFeeStr?: string | null;
};

/**
 * @deprecated Prefer `inferLegacyOrderFinancialBreakdown` or `inferCanonicalOrderFinancialBreakdown`.
 * Kept for captain mobile and other callers that only have `amount` + `cash_collection`.
 */
export function inferOrderFinancialBreakdown(
  amountStr: string,
  cashCollectionStr: string,
  opts?: InferOrderFinancialBreakdownOptions,
): OrderFinancialBreakdownDto {
  const base = computeLegacyOrderFinancialBreakdown(amountStr, cashCollectionStr);
  const exRaw = opts?.explicitDeliveryFeeStr;
  if (exRaw != null && String(exRaw).trim() !== "") {
    const explicitFee = round2(parseMoney(String(exRaw)));
    if (explicitFee >= 0) {
      return {
        ...base,
        deliveryFee: fmt(explicitFee),
        deliveryFeeSource: "explicit",
      };
    }
  }
  return base;
}
