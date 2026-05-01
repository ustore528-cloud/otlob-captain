-- AlterTable — additive nullable columns (Phase 2 public request sender/recipient split)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "sender_full_name" VARCHAR(200);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "sender_phone" VARCHAR(32);
