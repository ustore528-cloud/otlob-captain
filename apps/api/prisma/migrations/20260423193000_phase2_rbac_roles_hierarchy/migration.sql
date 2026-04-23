-- Phase 2 RBAC: replace flat ADMIN/STORE roles with scoped hierarchy.

CREATE TYPE "UserRole_new" AS ENUM (
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'BRANCH_MANAGER',
  'STORE_ADMIN',
  'DISPATCHER',
  'CAPTAIN',
  'CUSTOMER'
);

ALTER TABLE "users"
ALTER COLUMN "role" TYPE "UserRole_new"
USING (
  CASE
    WHEN "role"::text = 'STORE' THEN 'STORE_ADMIN'
    WHEN "role"::text = 'ADMIN' AND "company_id" IS NULL AND "branch_id" IS NULL THEN 'SUPER_ADMIN'
    WHEN "role"::text = 'ADMIN' AND "company_id" IS NOT NULL AND "branch_id" IS NULL THEN 'COMPANY_ADMIN'
    WHEN "role"::text = 'ADMIN' AND "company_id" IS NOT NULL AND "branch_id" IS NOT NULL THEN 'BRANCH_MANAGER'
    ELSE "role"::text
  END::"UserRole_new"
);

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
