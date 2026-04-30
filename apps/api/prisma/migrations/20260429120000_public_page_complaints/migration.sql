-- CreateEnum
CREATE TYPE "PublicPageComplaintStatus" AS ENUM ('NEW', 'REVIEWED', 'RESOLVED');

-- CreateTable
CREATE TABLE "public_page_complaints" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "complaint_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "PublicPageComplaintStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_page_complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "public_page_complaints_company_id_created_at_idx" ON "public_page_complaints"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "public_page_complaints_status_idx" ON "public_page_complaints"("status");

-- AddForeignKey
ALTER TABLE "public_page_complaints" ADD CONSTRAINT "public_page_complaints_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
