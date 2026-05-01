-- Step 4: customer web push subscriptions — metadata, composite unique, inactive handling

ALTER TABLE "customer_public_push_subscriptions" ADD COLUMN "public_tracking_token" VARCHAR(64);
UPDATE "customer_public_push_subscriptions" AS s
SET "public_tracking_token" = o."public_tracking_token"
FROM "orders" AS o
WHERE o."id" = s."order_id" AND o."public_tracking_token" IS NOT NULL;

DELETE FROM "customer_public_push_subscriptions" WHERE "public_tracking_token" IS NULL;

ALTER TABLE "customer_public_push_subscriptions" ALTER COLUMN "public_tracking_token" SET NOT NULL;

ALTER TABLE "customer_public_push_subscriptions" ADD COLUMN "user_agent" TEXT;
ALTER TABLE "customer_public_push_subscriptions" ADD COLUMN "platform" VARCHAR(64);
ALTER TABLE "customer_public_push_subscriptions" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "customer_public_push_subscriptions" ADD COLUMN "last_success_at" TIMESTAMP(3);
ALTER TABLE "customer_public_push_subscriptions" ADD COLUMN "last_failure_at" TIMESTAMP(3);
ALTER TABLE "customer_public_push_subscriptions" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX IF EXISTS "customer_public_push_subscriptions_endpoint_key";

CREATE UNIQUE INDEX "customer_public_push_subscriptions_order_id_endpoint_key"
  ON "customer_public_push_subscriptions" ("order_id", "endpoint");

CREATE INDEX "customer_public_push_subscriptions_order_id_is_active_idx"
  ON "customer_public_push_subscriptions" ("order_id", "is_active");
