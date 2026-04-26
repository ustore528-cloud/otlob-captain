-- Company Admin public code + order ownership snapshot + optional zone on orders/captains

ALTER TABLE "users" ADD COLUMN "public_owner_code" VARCHAR(64);

CREATE UNIQUE INDEX "users_public_owner_code_key" ON "users"("public_owner_code");

ALTER TABLE "orders" ADD COLUMN "order_owner_user_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "order_public_owner_code" VARCHAR(64);
ALTER TABLE "orders" ADD COLUMN "zone_id" TEXT;

ALTER TABLE "captains" ADD COLUMN "zone_id" TEXT;

ALTER TABLE "orders" ADD CONSTRAINT "orders_order_owner_user_id_fkey" FOREIGN KEY ("order_owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders" ADD CONSTRAINT "orders_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "captains" ADD CONSTRAINT "captains_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "orders_order_owner_user_id_idx" ON "orders"("order_owner_user_id");
CREATE INDEX "orders_zone_id_idx" ON "orders"("zone_id");
CREATE INDEX "captains_zone_id_idx" ON "captains"("zone_id");

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM users
  WHERE role = 'COMPANY_ADMIN' AND public_owner_code IS NULL
)
UPDATE users u
SET public_owner_code = 'CA-' || LPAD(r.rn::text, 4, '0')
FROM ranked r
WHERE u.id = r.id;

UPDATE orders o
SET order_owner_user_id = o.created_by_user_id
FROM users u
WHERE o.created_by_user_id = u.id
  AND u.role = 'COMPANY_ADMIN'
  AND o.order_owner_user_id IS NULL;

UPDATE orders o
SET order_public_owner_code = u.public_owner_code
FROM users u
WHERE o.order_owner_user_id = u.id
  AND o.order_public_owner_code IS NULL
  AND u.public_owner_code IS NOT NULL;
