/**
 * ## Legacy two-field model (`amount` + `cashCollection`)
 *
 * The persistence layer only stores:
 * - **`amount`**: order line value as entered for the store / merchandise (قيمة الطلب).
 * - **`cashCollection`**: when &gt; 0, treated as **cash-on-delivery total** due from the customer.
 *
 * There are **no** separate columns today for delivery fee, service fee, or store payout.
 *
 * ## Inferred “delivery fee”
 *
 * When COD is used (`cashCollection` &gt; 0), we compute:
 *
 * `deliveryFee = max(0, round2(cashCollection - amount))`
 *
 * This is **not** a guaranteed real-world “delivery fee” from pricing rules. It is the
 * **residual** after subtracting the stored order line from the customer total. That residual
 * may represent delivery, platform fee, rounding, bundled charges, or any mix — **the backend
 * does not disambiguate**.
 *
 * ## When this inference is wrong or misleading
 *
 * - **`cashCollection` ≤ `amount`** (e.g. data entry quirks): inferred delivery = `0` even if a real fee exists elsewhere.
 * - **`amount` already includes** taxes/fees that are not mirrored in how `cashCollection` was entered.
 * - **Discounts / partial refunds** not reflected consistently in both fields.
 * - **Store payout** is not modeled; we only surface `payToStore` = order line (`amount`) as a captain hint.
 *
 * ## Future: explicit fields
 *
 * When the product needs authoritative lines, add persisted fields (or a JSON breakdown) such as
 * `deliveryFee`, `customerTotal`, `storePayout`, and expose them in the API **with**
 * `deliveryFeeSource: "explicit"` so UIs stop relying on inference.
 */

export type OrderFinancialDeliveryFeeSource = "inferred" | "explicit";

export type OrderFinancialBreakdownDto = {
  /** Same semantic as order `amount` — قيمة الطلب / دفع للمتجر (مرجعية حالياً من الحقل `amount`) */
  orderAmount: string;
  /**
   * Shown as “رسوم التوصيل” in UI when inferred — see module JSDoc: this is the **residual**, not necessarily a priced delivery line.
   */
  deliveryFee: string;
  /** إجمالي مستحق من العميل (نقد عند التسليم أو يساوي قيمة الطلب عند عدم وجود COD منفصل) */
  customerTotal: string;
  /** مرادف لـ orderAmount في النموذج الحالي — دفع المتجر مقابل البضاعة */
  payToStore: string;
  /** غير مُخزَّن حالياً — null حتى يدعم المنتج تسوية المتجر صراحةً */
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

/**
 * Builds the captain-facing breakdown used by API DTOs and mobile when no explicit overrides exist.
 * Always sets `deliveryFeeSource: "inferred"` until the API persists authoritative fee lines.
 */
export function inferOrderFinancialBreakdown(amountStr: string, cashCollectionStr: string): OrderFinancialBreakdownDto {
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
