-- Phase 1 multi-tenant foundation — minimal additive migration with safe backfill.
-- Default tenant IDs (stable across environments for this migration only):
--   company: cd8xptlzhophhzlxl036ehf6g
--   city:    c85gd4n9blhewhlqagxp83hmr
--   zone:    cxgvwm6hklin6ugsc6ab502e2
--   branch:  cpkeiii7o4nfcxx7d0ymncwcs

CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "city_id" TEXT,
    "zone_id" TEXT,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "default_delivery_fee" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_settings_company_id_key" ON "delivery_settings"("company_id");

INSERT INTO "companies" ("id", "name", "is_active", "created_at", "updated_at")
VALUES ('cd8xptlzhophhzlxl036ehf6g', 'الشركة الافتراضية', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "cities" ("id", "company_id", "name", "is_active", "created_at", "updated_at")
VALUES ('c85gd4n9blhewhlqagxp83hmr', 'cd8xptlzhophhzlxl036ehf6g', 'المدينة الافتراضية', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "zones" ("id", "city_id", "name", "is_active", "created_at", "updated_at")
VALUES ('cxgvwm6hklin6ugsc6ab502e2', 'c85gd4n9blhewhlqagxp83hmr', 'المنطقة الافتراضية', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "branches" ("id", "company_id", "city_id", "zone_id", "name", "is_active", "created_at", "updated_at")
VALUES (
    'cpkeiii7o4nfcxx7d0ymncwcs',
    'cd8xptlzhophhzlxl036ehf6g',
    'c85gd4n9blhewhlqagxp83hmr',
    'cxgvwm6hklin6ugsc6ab502e2',
    'الفرع الافتراضي',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT INTO "delivery_settings" ("id", "company_id", "default_delivery_fee", "created_at", "updated_at")
VALUES ('chlit4xwyzrk0mj5xf7faqjuv', 'cd8xptlzhophhzlxl036ehf6g', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "cities" ADD CONSTRAINT "cities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "zones" ADD CONSTRAINT "zones_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "branches" ADD CONSTRAINT "branches_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "branches" ADD CONSTRAINT "branches_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_settings" ADD CONSTRAINT "delivery_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "cities_company_id_idx" ON "cities"("company_id");
CREATE INDEX "zones_city_id_idx" ON "zones"("city_id");
CREATE INDEX "branches_company_id_idx" ON "branches"("company_id");
CREATE INDEX "branches_city_id_idx" ON "branches"("city_id");
CREATE INDEX "branches_zone_id_idx" ON "branches"("zone_id");

-- Users: optional staff scope
ALTER TABLE "users" ADD COLUMN "company_id" TEXT;
ALTER TABLE "users" ADD COLUMN "branch_id" TEXT;

ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "users_company_id_idx" ON "users"("company_id");
CREATE INDEX "users_branch_id_idx" ON "users"("branch_id");

UPDATE "users" SET "company_id" = 'cd8xptlzhophhzlxl036ehf6g', "branch_id" = NULL
WHERE "role" IN ('ADMIN', 'DISPATCHER');

-- Stores
ALTER TABLE "stores" ADD COLUMN "company_id" TEXT;
ALTER TABLE "stores" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "stores" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "stores" ADD COLUMN "longitude" DOUBLE PRECISION;

UPDATE "stores" SET "company_id" = 'cd8xptlzhophhzlxl036ehf6g', "branch_id" = 'cpkeiii7o4nfcxx7d0ymncwcs' WHERE "company_id" IS NULL;

ALTER TABLE "stores" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "stores" ALTER COLUMN "branch_id" SET NOT NULL;

ALTER TABLE "stores" ADD CONSTRAINT "stores_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stores" ADD CONSTRAINT "stores_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "stores_company_id_branch_id_idx" ON "stores"("company_id", "branch_id");

-- Captains
ALTER TABLE "captains" ADD COLUMN "company_id" TEXT;
ALTER TABLE "captains" ADD COLUMN "branch_id" TEXT;

UPDATE "captains" SET "company_id" = 'cd8xptlzhophhzlxl036ehf6g', "branch_id" = 'cpkeiii7o4nfcxx7d0ymncwcs' WHERE "company_id" IS NULL;

ALTER TABLE "captains" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "captains" ALTER COLUMN "branch_id" SET NOT NULL;

ALTER TABLE "captains" ADD CONSTRAINT "captains_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "captains" ADD CONSTRAINT "captains_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "captains_company_id_branch_id_idx" ON "captains"("company_id", "branch_id");

-- Orders
ALTER TABLE "orders" ADD COLUMN "company_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "pickup_lat" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "pickup_lng" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "dropoff_lat" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "dropoff_lng" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "delivery_fee" DECIMAL(12,2);

UPDATE "orders" o
SET "company_id" = s."company_id", "branch_id" = s."branch_id"
FROM "stores" s
WHERE o."store_id" = s."id" AND o."company_id" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "branch_id" SET NOT NULL;

ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "orders_company_id_branch_id_idx" ON "orders"("company_id", "branch_id");
