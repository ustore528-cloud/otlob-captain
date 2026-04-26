-- Slice 1: unified wallet + ledger (additive only). No hooks on Order/Captain yet.
-- Locked enums: WalletOwnerType, LedgerEntryType (see Slice 0).

-- CreateEnum
CREATE TYPE "WalletOwnerType" AS ENUM ('STORE', 'SUPERVISOR_USER', 'CAPTAIN');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM (
  'SUPER_ADMIN_TOP_UP',
  'WALLET_TRANSFER',
  'ORDER_DELIVERED_STORE_DEBIT',
  'ORDER_DELIVERED_CAPTAIN_DEDUCTION',
  'ADJUSTMENT'
);

-- CreateTable
CREATE TABLE "wallet_accounts" (
  "id" TEXT NOT NULL,
  "owner_type" "WalletOwnerType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'SAR',
  "balance_cached" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
  "id" TEXT NOT NULL,
  "wallet_account_id" TEXT NOT NULL,
  "entry_type" "LedgerEntryType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'SAR',
  "idempotency_key" TEXT,
  "order_id" TEXT,
  "counterparty_account_id" TEXT,
  "reference_type" VARCHAR(64),
  "reference_id" TEXT,
  "metadata" JSONB,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_accounts_owner_type_owner_id_key" ON "wallet_accounts"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "wallet_accounts_company_id_idx" ON "wallet_accounts"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_idempotency_key_key" ON "ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_entries_wallet_account_id_created_at_idx" ON "ledger_entries"("wallet_account_id", "created_at");

-- CreateIndex
CREATE INDEX "ledger_entries_order_id_idx" ON "ledger_entries"("order_id");

-- AddForeignKey
ALTER TABLE "wallet_accounts"
  ADD CONSTRAINT "wallet_accounts_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_wallet_account_id_fkey"
  FOREIGN KEY ("wallet_account_id") REFERENCES "wallet_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_counterparty_account_id_fkey"
  FOREIGN KEY ("counterparty_account_id") REFERENCES "wallet_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
