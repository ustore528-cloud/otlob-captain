-- Phase A: `regions` + optional `stores.primary_region_id` (store→region anchoring)
-- Additive only; no changes to order rows or order logic.

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "boundary_geojson" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "regions_company_id_is_active_idx" ON "regions"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "regions_parent_id_idx" ON "regions"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "regions_company_id_code_key" ON "regions"("company_id", "code");

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN "primary_region_id" TEXT;

-- CreateIndex
CREATE INDEX "stores_primary_region_id_idx" ON "stores"("primary_region_id");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_primary_region_id_fkey" FOREIGN KEY ("primary_region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
