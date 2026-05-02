-- Chatbot assistant V1 — نسجل المحادثة فقط (لا تأثير مباشر على الطلبات)

CREATE TYPE "ChatbotAudience" AS ENUM ('DASHBOARD', 'CUSTOMER_PUBLIC');

CREATE TABLE "chatbot_conversations" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "audience" "ChatbotAudience" NOT NULL,
    "dashboard_user_id" TEXT,
    "company_scope_id" TEXT,
    "public_owner_code" VARCHAR(64),
    "public_order_id" TEXT,
    "public_tracking_token" VARCHAR(200),
    CONSTRAINT "chatbot_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chatbot_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chatbot_conversations_audience_dashboard_user_id_updated_at_idx" ON "chatbot_conversations"("audience", "dashboard_user_id", "updated_at");

CREATE INDEX "chatbot_conversations_audience_company_scope_id_updated_at_idx" ON "chatbot_conversations"("audience", "company_scope_id", "updated_at");

CREATE INDEX "chatbot_messages_conversation_id_created_at_idx" ON "chatbot_messages"("conversation_id", "created_at");

ALTER TABLE "chatbot_messages" ADD CONSTRAINT "chatbot_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chatbot_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
