-- After slice1 wallet/ledger: captain prepaid charge/adjust ledger entry types + join key (runs afterLedgerEntryType exists).

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'CAPTAIN_PREPAID_CHARGE';
ALTER TYPE "LedgerEntryType" ADD VALUE 'CAPTAIN_PREPAID_ADJUSTMENT';

-- AlterTable
ALTER TABLE "captain_balance_transactions" ADD COLUMN "prepaid_ledger_operation_id" TEXT;

CREATE UNIQUE INDEX "captain_balance_transactions_prepaid_ledger_operation_id_key" ON "captain_balance_transactions"("prepaid_ledger_operation_id");

CREATE INDEX "ledger_entries_reference_type_reference_id_idx" ON "ledger_entries"("reference_type", "reference_id");
