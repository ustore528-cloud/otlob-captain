-- Additive RBAC migration: introduce new scoped roles without deleting existing ones.
-- Intentionally no destructive changes; role remapping is handled by a separate idempotent script.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CAPTAIN_SUPERVISOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STORE_USER';

