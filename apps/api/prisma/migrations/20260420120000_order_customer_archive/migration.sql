-- Order ↔ customer account linkage + soft archive (admin operational lists exclude archived rows)

ALTER TABLE "orders" ADD COLUMN "customer_user_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "orders_customer_user_id_idx" ON "orders"("customer_user_id");
CREATE INDEX "orders_archived_at_idx" ON "orders"("archived_at");

ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
