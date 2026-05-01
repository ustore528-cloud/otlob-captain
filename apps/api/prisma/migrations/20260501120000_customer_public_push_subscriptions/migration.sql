CREATE TABLE "customer_public_push_subscriptions" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" VARCHAR(256) NOT NULL,
    "locale" VARCHAR(8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_public_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_public_push_subscriptions_endpoint_key" ON "customer_public_push_subscriptions"("endpoint");

CREATE INDEX "customer_public_push_subscriptions_order_id_idx" ON "customer_public_push_subscriptions"("order_id");

ALTER TABLE "customer_public_push_subscriptions"
ADD CONSTRAINT "customer_public_push_subscriptions_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
