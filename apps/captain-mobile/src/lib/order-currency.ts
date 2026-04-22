/**
 * Order amount display — Palestine / Israel market scope (captain mobile).
 *
 * **Source of truth:** API DTOs expose `amount` and `cashCollection` as decimal strings only.
 * There is no per-order `currency` field in the mobile DTOs today; the display layer therefore
 * uses **New Israeli Shekel (ILS)** uniformly — the common settlement unit for cross-area
 * delivery operations between Palestinian territories and Israel. If the backend later adds
 * `currency` (or regional pricing), map this module to that field instead of hardcoding ILS.
 */

/** Arabic-facing suffix (number + symbol). */
export const ORDER_CURRENCY_SUFFIX_AR = "₪";

/** English-facing ISO code for accessibility / Latin copy. */
export const ORDER_CURRENCY_CODE_EN = "ILS";

export function formatOrderAmountAr(amount: string): string {
  const a = amount.trim();
  return a ? `${a} ${ORDER_CURRENCY_SUFFIX_AR}` : `— ${ORDER_CURRENCY_SUFFIX_AR}`;
}

export function formatOrderAmountEnLine(label: string, amount: string): string {
  const a = amount.trim();
  return `${label} ${a} ${ORDER_CURRENCY_CODE_EN}`;
}
