-- Phase 5: real pickup / delivery instants (nullable; no backfill).
ALTER TABLE "orders" ADD COLUMN "picked_up_at" TIMESTAMP(3),
ADD COLUMN "delivered_at" TIMESTAMP(3);
