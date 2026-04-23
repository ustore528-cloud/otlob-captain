-- Captain prepaid balance accounting and ledger.

CREATE TYPE "CaptainBalanceTransactionType" AS ENUM ('CHARGE', 'DEDUCTION', 'REFUND', 'ADJUSTMENT');

ALTER TABLE "captains"
  ADD COLUMN "prepaid_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "commission_percent" DECIMAL(5,2),
  ADD COLUMN "prepaid_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "total_charged" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "total_deducted" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "minimum_balance_to_receive_orders" DECIMAL(12,2),
  ADD COLUMN "last_balance_updated_at" TIMESTAMP(3);

CREATE TABLE "captain_balance_transactions" (
  "id" TEXT NOT NULL,
  "captain_id" TEXT NOT NULL,
  "type" "CaptainBalanceTransactionType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "balance_after" DECIMAL(12,2) NOT NULL,
  "commission_percent_snapshot" DECIMAL(5,2),
  "delivery_fee_snapshot" DECIMAL(12,2),
  "order_id" TEXT,
  "note" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "captain_balance_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "captain_balance_transactions_captain_id_order_id_type_key"
  ON "captain_balance_transactions"("captain_id", "order_id", "type");
CREATE INDEX "captain_balance_transactions_captain_id_created_at_idx"
  ON "captain_balance_transactions"("captain_id", "created_at");
CREATE INDEX "captain_balance_transactions_order_id_idx"
  ON "captain_balance_transactions"("order_id");

ALTER TABLE "captain_balance_transactions"
  ADD CONSTRAINT "captain_balance_transactions_captain_id_fkey"
  FOREIGN KEY ("captain_id") REFERENCES "captains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "captain_balance_transactions"
  ADD CONSTRAINT "captain_balance_transactions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dashboard_settings"
  ADD COLUMN "prepaid_captains_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "prepaid_default_commission_percent" DECIMAL(5,2) NOT NULL DEFAULT 15,
  ADD COLUMN "prepaid_allow_captain_custom_commission" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "prepaid_minimum_balance_to_receive_orders" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "prepaid_allow_manual_assignment_override" BOOLEAN NOT NULL DEFAULT false;
