/**
 * Re-exports shared inference so captain mobile and API stay aligned.
 *
 * **Authoritative path:** use `financialBreakdown` from `GET /orders/:id` (canonical
 * `amount` + `delivery_fee` + `cash_collection`).
 *
 * **Fallback (list / legacy rows):** `inferOrderFinancialBreakdown(amount, cashCollection)` when
 * `delivery_fee` was not stored — see `inferLegacyOrderFinancialBreakdown` in `@captain/shared`.
 */

import {
  inferCanonicalOrderFinancialBreakdown,
  inferLegacyOrderFinancialBreakdown,
  inferOrderFinancialBreakdown,
  type OrderFinancialBreakdownDto,
} from "@captain/shared";

export type { OrderFinancialBreakdownDto };

export type CaptainOrderFinancialBreakdown = {
  orderValue: number;
  deliveryFee: number;
  finalTotalFromCustomer: number;
  collectFromCustomer: number;
  payToStore: number;
  isCashOnDelivery: boolean;
};

function parseMoney(s: string): number {
  const n = parseFloat(String(s ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** @deprecated Prefer `inferOrderFinancialBreakdown` + `OrderFinancialBreakdownDto` from API when available. */
export function computeCaptainOrderFinancialBreakdown(amount: string, cashCollection: string): CaptainOrderFinancialBreakdown {
  const f = inferOrderFinancialBreakdown(amount, cashCollection);
  return dtoToCaptainShape(f);
}

export function dtoToCaptainShape(f: OrderFinancialBreakdownDto): CaptainOrderFinancialBreakdown {
  return {
    orderValue: round2(parseMoney(f.orderAmount)),
    deliveryFee: round2(parseMoney(f.deliveryFee)),
    finalTotalFromCustomer: round2(parseMoney(f.customerTotal)),
    collectFromCustomer: round2(parseMoney(f.customerTotal)),
    payToStore: round2(parseMoney(f.payToStore)),
    isCashOnDelivery: f.isCashOnDelivery,
  };
}

export { inferOrderFinancialBreakdown };

/**
 * Resolves the same money snapshot the API attaches in `financialBreakdown`, for list/overflow
 * rows that only expose raw `amount` / `deliveryFee` / `cashCollection`.
 */
export function resolveOrderFinancialBreakdownDto(args: {
  amount: string;
  cashCollection: string;
  deliveryFee?: string | null;
  financialBreakdown?: OrderFinancialBreakdownDto | null;
}): OrderFinancialBreakdownDto {
  if (args.financialBreakdown) return args.financialBreakdown;
  const feeRaw = args.deliveryFee;
  if (feeRaw != null && String(feeRaw).trim() !== "") {
    return inferCanonicalOrderFinancialBreakdown(args.amount, String(feeRaw), args.cashCollection);
  }
  return inferLegacyOrderFinancialBreakdown(args.amount, args.cashCollection);
}

export function formatIlsAmount(n: number): string {
  return round2(n).toFixed(2);
}

/** Dev-only sanity checks; run via `npm run validate:financial-logic` from captain-mobile. */
export function assertFinancialBreakdownSelfTest(): void {
  const a = inferOrderFinancialBreakdown("100", "120");
  if (a.deliveryFee !== "20.00" || a.customerTotal !== "120.00" || a.deliveryFeeSource !== "inferred") {
    throw new Error(`COD case failed: ${JSON.stringify(a)}`);
  }
  const b = inferOrderFinancialBreakdown("50", "0");
  if (b.customerTotal !== "50.00" || b.deliveryFee !== "0.00" || b.isCashOnDelivery) {
    throw new Error(`Non-COD case failed: ${JSON.stringify(b)}`);
  }
  const c = inferOrderFinancialBreakdown("120", "120");
  if (c.deliveryFee !== "0.00" || c.customerTotal !== "120.00") {
    throw new Error(`Equal case failed: ${JSON.stringify(c)}`);
  }
}
