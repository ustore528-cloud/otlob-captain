/**
 * Join key for `ledger_entries` (referenceType + referenceId) ↔ `captain_balance_transactions.prepaidLedgerOperationId`
 */
export const LEDGER_REF_CAPTAIN_PREPAID_OP = "CAPTAIN_PREPAID_OP" as const;

/** Prisma default interactive `timeout` is 5s; charge/adjust include ledger + prepaid + activity on remote DB. */
export const CAPTAIN_PREPAID_LEDGER_MUTATION_TX_OPTIONS = { maxWait: 10_000, timeout: 60_000 } as const;

export function prepaidChargeLedgerIdempotencyKey(opId: string): string {
  return `prepaid:charge:${opId}`;
}

export function prepaidAdjustLedgerIdempotencyKey(opId: string): string {
  return `prepaid:adjust:${opId}`;
}

/**
 * Client idempotency for `POST /finance/captains/:captainId/prepaid-charge` (separate from legacy
 * `prepaid:charge:{uuid}`). Same string is used as `ledger_entries.idempotencyKey` and as the join
 * key `captain_balance_transactions.prepaid_ledger_operation_id` / ledger `referenceId`.
 */
export function financePrepaidChargeClientIdempotencyKey(
  flow: "company_admin" | "super_admin",
  captainId: string,
  clientIdempotencyKey: string,
): string {
  const p = flow === "company_admin" ? "ca-topup" : "admin-topup";
  return `${p}:captain:${captainId}:${clientIdempotencyKey.trim()}`;
}
