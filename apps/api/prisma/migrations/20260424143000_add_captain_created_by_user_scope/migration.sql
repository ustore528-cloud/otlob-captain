-- Additive ownership field for captain isolation by COMPANY_ADMIN.
ALTER TABLE "captains"
ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT NULL;

ALTER TABLE "captains"
ADD CONSTRAINT "captains_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "captains_created_by_user_id_idx" ON "captains"("created_by_user_id");

