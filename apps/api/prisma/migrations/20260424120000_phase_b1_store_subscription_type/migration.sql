-- Phase B (slice 1): store subscription mode + optional captain-supervisor user link
-- Additive; default PUBLIC preserves existing behavior for all current rows.

-- CreateEnum
CREATE TYPE "StoreSubscriptionType" AS ENUM ('PUBLIC', 'SUPERVISOR_LINKED');

-- AlterTable
ALTER TABLE "stores" ADD COLUMN "subscription_type" "StoreSubscriptionType" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "stores" ADD COLUMN "supervisor_user_id" TEXT;

-- CreateIndex
CREATE INDEX "stores_supervisor_user_id_idx" ON "stores"("supervisor_user_id");

-- CreateIndex
CREATE INDEX "stores_subscription_type_idx" ON "stores"("subscription_type");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_supervisor_user_id_fkey" FOREIGN KEY ("supervisor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
