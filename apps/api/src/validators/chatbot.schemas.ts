import { z } from "zod";

export const ChatbotPublicContextSchema = z.discriminatedUnion("surface", [
  z.object({ surface: z.literal("public_request"), ownerCode: z.string().trim().min(1).max(80) }),
  z.object({
    surface: z.literal("public_order"),
    ownerCode: z.string().trim().min(1).max(80),
    orderId: z.string().trim().min(1).max(64),
    trackingToken: z.string().trim().min(1).max(520),
  }),
]);

export type ChatbotPublicContextBody = z.infer<typeof ChatbotPublicContextSchema>;

export const ChatbotPostMessageBodySchema = z.object({
  conversationId: z.string().trim().min(8).max(92).optional(),
  locale: z.enum(["ar", "en", "he"]).optional(),
  message: z.string().trim().min(1).max(2800),
  context: ChatbotPublicContextSchema.optional(),
});

export const ChatbotConversationIdParamsSchema = z.object({
  conversationId: z.string().trim().min(8).max(92),
});

/** GET/POST عموميان — حقول المتجر أو التتبع اختيارية حتى يتحقّق المسؤول وفق المحادثة */
export const ChatbotConversationGetQuerySchema = z.object({
  ownerCode: z.string().trim().optional(),
  orderId: z.string().trim().optional(),
  token: z.string().trim().optional(),
});
