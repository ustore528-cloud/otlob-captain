import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { closeChatConversation, getChatConversation, postChatbotMessage } from "../services/chatbot.service.js";

export const chatbotController = {
  postMessage: async (req: Request, res: Response) => {
    const data = await postChatbotMessage({
      user: req.user,
      body: req.body as Parameters<typeof postChatbotMessage>[0]["body"],
    });
    return res.status(200).json(ok(data));
  },

  getConversation: async (req: Request, res: Response) => {
    const conversationId =
      typeof req.params.conversationId === "string" ? req.params.conversationId.trim() : "";
    if (!conversationId)
      throw new Error("CONVERSATION_ID_REQUIRED"); // لم يحدث عند استخدام مخطّط المسار

    if (req.user) {
      const data = await getChatConversation({
        user: req.user,
        conversationId,
        proof: undefined,
      });
      return res.json(ok(data));
    }

    const ownerCodeRaw = typeof req.query.ownerCode === "string" ? req.query.ownerCode.trim() : "";
    const orderIdRaw = typeof req.query.orderId === "string" ? req.query.orderId.trim() : "";
    const tokenRaw = typeof req.query.token === "string" ? req.query.token.trim() : "";

    const data = await getChatConversation({
      user: undefined,
      conversationId,
      proof:
        ownerCodeRaw && orderIdRaw && tokenRaw
          ? { ownerCode: ownerCodeRaw, orderId: orderIdRaw, token: tokenRaw }
          : ownerCodeRaw
            ? { ownerCode: ownerCodeRaw }
            : undefined,
    });
    return res.json(ok(data));
  },

  close: async (req: Request, res: Response) => {
    const conversationId =
      typeof req.params.conversationId === "string" ? req.params.conversationId.trim() : "";

    const ownerCodeRaw = typeof req.query.ownerCode === "string" ? req.query.ownerCode.trim() : "";
    const orderIdRaw = typeof req.query.orderId === "string" ? req.query.orderId.trim() : "";
    const tokenRaw = typeof req.query.token === "string" ? req.query.token.trim() : "";

    const data = await closeChatConversation({
      user: req.user,
      conversationId,
      proof:
        ownerCodeRaw && orderIdRaw && tokenRaw
          ? { ownerCode: ownerCodeRaw, orderId: orderIdRaw, token: tokenRaw }
          : ownerCodeRaw
            ? { ownerCode: ownerCodeRaw }
            : undefined,
    });
    return res.json(ok(data));
  },
};
