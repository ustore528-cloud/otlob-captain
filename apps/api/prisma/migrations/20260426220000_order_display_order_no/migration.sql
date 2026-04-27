-- Per-company UI sequence (nullable for legacy rows until backfill).
ALTER TABLE "orders" ADD COLUMN "display_order_no" INTEGER;

CREATE INDEX "orders_company_id_display_order_no_idx" ON "orders"("company_id", "display_order_no");
CREATE UNIQUE INDEX "orders_company_id_display_order_no_key" ON "orders"("company_id", "display_order_no");
