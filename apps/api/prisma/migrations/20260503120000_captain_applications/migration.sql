-- CreateEnum
CREATE TYPE "CaptainApplicationStatus" AS ENUM ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'CONVERTED_TO_CAPTAIN');

-- CreateEnum
CREATE TYPE "CaptainApplicationAvailability" AS ENUM ('FULL_TIME', 'PART_TIME');

-- CreateTable
CREATE TABLE "captain_applications" (
    "id" TEXT NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "primary_phone" VARCHAR(32) NOT NULL,
    "whatsapp_phone" VARCHAR(32) NOT NULL,
    "date_of_birth" DATE,
    "age_years" INTEGER,
    "city" VARCHAR(120) NOT NULL,
    "full_address" TEXT NOT NULL,
    "languages_spoken" JSONB NOT NULL,
    "vehicle_type" VARCHAR(80) NOT NULL,
    "vehicle_number" VARCHAR(64),
    "preferred_work_areas" TEXT NOT NULL,
    "can_enter_jerusalem" BOOLEAN NOT NULL,
    "can_enter_interior" BOOLEAN NOT NULL,
    "availability" "CaptainApplicationAvailability" NOT NULL,
    "notes" TEXT,
    "status" "CaptainApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "internal_notes" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "captain_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "captain_applications_status_created_at_idx" ON "captain_applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "captain_applications_primary_phone_idx" ON "captain_applications"("primary_phone");

-- CreateIndex
CREATE INDEX "captain_applications_city_idx" ON "captain_applications"("city");

-- AddForeignKey
ALTER TABLE "captain_applications" ADD CONSTRAINT "captain_applications_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
