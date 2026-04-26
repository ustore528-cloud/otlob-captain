/**
 * When true, delivered-order financial movements use the unified ledger hook and the legacy
 * `deductForDeliveredOrderTx` captain prepaid path is skipped (see orders service).
 */
export const ORDER_DELIVERED_LEDGER_HOOK_ENABLED = true;

/** Longer than Prisma’s default 5s — delivered ledger can run multiple `appendLedgerEntryInTx` + policy loads. */
export const ORDER_STATUS_TX_OPTIONS: { maxWait: number; timeout: number } = {
  maxWait: 10_000,
  timeout: 60_000,
};
