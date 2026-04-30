-- Additive: optional JSON blobs for localized UI copies. Stored fields remain authoritative.

ALTER TABLE "users" ADD COLUMN "display_i18n" JSONB;

ALTER TABLE "companies" ADD COLUMN "display_i18n" JSONB;

ALTER TABLE "stores" ADD COLUMN "display_i18n" JSONB;

ALTER TABLE "regions" ADD COLUMN "display_i18n" JSONB;

ALTER TABLE "captains" ADD COLUMN "display_i18n" JSONB;

ALTER TABLE "notifications" ADD COLUMN "display_i18n" JSONB;
