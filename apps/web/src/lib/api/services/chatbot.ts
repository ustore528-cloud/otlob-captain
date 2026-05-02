import { paths, apiFetch } from "@/lib/api/http";

export type ChatbotPostContext =
  | { surface: "public_request"; ownerCode: string }
  | { surface: "public_order"; ownerCode: string; orderId: string; trackingToken: string };

export type ChatbotMessageResponse = {
  conversationId: string;
  reply: string;
  quickReplies: string[];
  intent: string;
};

export async function chatbotSendMessage(payload: {
  token?: string | null;
  conversationId?: string;
  locale?: "ar" | "en" | "he";
  message: string;
  context?: ChatbotPostContext;
}): Promise<ChatbotMessageResponse> {
  return apiFetch(paths.chatbot.message, {
    method: "POST",
    token: payload.token ?? undefined,
    body: JSON.stringify({
      conversationId: payload.conversationId,
      locale: payload.locale,
      message: payload.message,
      context: payload.context,
    }),
  });
}

export type ChatbotConversationMessage = {
  role: string;
  content: string;
  createdAt: string;
};

export async function chatbotFetchConversation(payload: {
  token?: string | null;
  conversationId: string;
  query?: Partial<{ ownerCode: string; orderId: string; token: string }>;
}): Promise<{ conversationId: string; closedAt: string | null; messages: ChatbotConversationMessage[] }> {
  return apiFetch(paths.chatbot.conversation(payload.conversationId, payload.query), {
    method: "GET",
    token: payload.token ?? undefined,
  });
}

export async function chatbotCloseConversation(payload: {
  token?: string | null;
  conversationId: string;
  query?: Partial<{ ownerCode: string; orderId: string; token: string }>;
}): Promise<{ ok: true }> {
  return apiFetch(paths.chatbot.closeConversation(payload.conversationId, payload.query), {
    method: "POST",
    token: payload.token ?? undefined,
  });
}
