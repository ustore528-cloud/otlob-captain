-- CreateTable
CREATE TABLE "captain_push_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "app_version" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "captain_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "captain_push_tokens_token_key" ON "captain_push_tokens"("token");

-- CreateIndex
CREATE INDEX "captain_push_tokens_user_id_is_active_updated_at_idx" ON "captain_push_tokens"("user_id", "is_active", "updated_at");

-- AddForeignKey
ALTER TABLE "captain_push_tokens" ADD CONSTRAINT "captain_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
