-- إعدادات صفحة الطلب العام + رمز تتبّع عميل الصفحة العامة

ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "public_page_settings" JSONB;

ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "public_tracking_token" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "orders_public_tracking_token_key" ON "orders" ("public_tracking_token");
