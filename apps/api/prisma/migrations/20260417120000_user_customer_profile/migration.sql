-- AlterTable: حقول ملف عميل (CUSTOMER) — مطابقة لحقول «طلب جديد»
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_pickup_address" VARCHAR(500);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_dropoff_address" VARCHAR(500);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_location_link" VARCHAR(2000);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_area" VARCHAR(200);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_dropoff_lat" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_dropoff_lng" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_preferred_amount" DECIMAL(12,2);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_preferred_delivery" DECIMAL(12,2);
