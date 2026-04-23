-- Phase B4: optional Captain.supervisorUserId (staff supervisor link, same validation rules as store).
-- Additive; NULL for all existing captains.

-- AlterTable
ALTER TABLE "captains" ADD COLUMN "captain_supervisor_user_id" TEXT;

-- CreateIndex
CREATE INDEX "captains_captain_supervisor_user_id_idx" ON "captains"("captain_supervisor_user_id");

-- AddForeignKey
ALTER TABLE "captains" ADD CONSTRAINT "captains_captain_supervisor_user_id_fkey" FOREIGN KEY ("captain_supervisor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
