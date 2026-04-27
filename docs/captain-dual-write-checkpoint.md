# Captain compatibility / dual-write — checkpoint (stable)

> Recorded as a stable baseline after the **deliver alignment** and **charge/adjust alignment** slices.  
> This document is a snapshot; it does not prescribe the next slice.

## Scope summary

| Area | System of record (wallet rail) | Product mirror (prepaid book) | Transaction shape |
|------|--------------------------------|--------------------------------|-------------------|
| **Order delivered** (captain commission) | `ledger_entries` `ORDER_DELIVERED_CAPTAIN_DEDUCTION` on captain `WalletAccount` | `captain_balance_transactions` **DEDUCTION** (when eligible) | Same DB transaction as status → `DELIVERED` |
| **Dashboard prepaid charge** | `ledger_entries` `CAPTAIN_PREPAID_CHARGE` | `captain_balance_transactions` **CHARGE** + `Captain.totalCharged` | Single interactive transaction |
| **Dashboard prepaid adjust** | `ledger_entries` `CAPTAIN_PREPAID_ADJUSTMENT` (signed `amount`) | `captain_balance_transactions` **ADJUSTMENT** (no `totalCharged` change) | Single interactive transaction |

`Captain.prepaidBalance` / `totalCharged` / `totalDeducted` are **not** redefined as derived from the wallet; they track the product ledger path as implemented.

---

## A. Deliver (ORDER_DELIVERED) alignment

- **Flag:** `ORDER_DELIVERED_LEDGER_HOOK_ENABLED` in `src/config/order-ledger-flags.ts` (when `true`, legacy `deductForDeliveredOrderTx` is skipped; ledger hook owns the path).
- **Order of writes:** (1) store debit line if `deliveryFee` &gt; 0, (2) captain deduction ledger line, (3) optional prepaid **mirror** (see below).
- **Prepaid mirror** (`mirrorDeliveredPrepaidDeductionAfterLedgerTx` in `captain-prepaid-balance.service.ts`):
  - Runs only if the ledger hook is enabled, `policy.prepaidEnabled` (system + captain), `commission` &gt; 0, and no existing `DEDUCTION` for the same `captainId` + `orderId`.
  - Creates **DEDUCTION**, updates `prepaidBalance` / `totalDeducted`, logs `CAPTAIN_PREPAID_DEDUCTED` with the same shape as the legacy path.
- **Commission for ledger** is resolved in line with the legacy basis (`resolveDeliveredCommissionForLedgerTx`); gate for the **mirror** is `prepaidEnabled`, not the commission resolution itself.

**Reconciliation (read-only):** `apps/api` → `npm run reconcile:deliver-ledger-prepaid` (script: `scripts/reconcile-deliver-ledger-prepaid.ts`, optional `SINCE`).

---

## B. Charge / adjust alignment (dashboard)

- **Config:** `src/config/captain-prepaid-ledger.ts` — `LEDGER_REF_CAPTAIN_PREPAID_OP`, idempotency key helpers, `CAPTAIN_PREPAID_LEDGER_MUTATION_TX_OPTIONS` (`maxWait` / `timeout` for long DB round-trips).
- **Order of writes:** (1) `appendLedgerEntryInTx` (captain wallet), (2) `captain_balance_transaction` with **`prepaidLedgerOperationId`**, (3) `Captain` balance fields, (4) activity.
- **Join key (shared operation id):**  
  - `captain_balance_transactions.prepaid_ledger_operation_id` (UUID)  
  - `ledger_entries.reference_id` = same UUID, `reference_type` = `CAPTAIN_PREPAID_OP`  
- **Server idempotency (not client):** `prepaid:charge:{opId}` / `prepaid:adjust:{opId}` on the ledger line.
- **Semantics:** charge increments **`totalCharged`**; adjustment does **not** touch `totalCharged`.

**Reconciliation (read-only):** `apps/api` → `npm run reconcile:captain-prepaid-charge-adjust` (optional `SINCE` on `captain_balance_transactions`).

---

## C. What this checkpoint does *not* include

- No claim about future slices (e.g. supervisor → captain transfer alignment, backfills, read-model consolidation).
- No deployment or runbook beyond migration apply + the verification scripts already in the repo.

## D. Reference implementation touchpoints (code)

| Concern | Primary files |
|--------|----------------|
| Deliver ledger + mirror | `order-delivered-ledger.service.ts`, `captain-prepaid-balance.service.ts` (`mirrorDelivered*`, `resolveDeliveredCommissionForLedgerTx`, `deductForDeliveredOrderTx` skip when hook on) |
| Order status integration | `orders.service.ts` (calls `applyDeliveredOrderLedgerTx` in the same path as `DELIVERED`) |
| Charge / adjust | `captain-prepaid-balance.service.ts` (`chargeCaptain`, `adjustCaptain`) |
| Prisma: ledger enum + cbt link | `prisma/schema.prisma` — `CAPTAIN_PREPAID_CHARGE`, `CAPTAIN_PREPAID_ADJUSTMENT`, `prepaidLedgerOperationId` |
| Finance UI types (new ledger enum literals) | `apps/web/src/types/api.ts`, `features/finance/components/finance-ledger-table.tsx` |

---

*Checkpoint valid as of: charge/adjust slice accepted and closed. Next work awaits explicit product/engineering instruction.*
