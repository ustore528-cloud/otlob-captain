import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { optionalAuthMiddleware } from "../../middlewares/optional-auth.middleware.js";
import { chatbotController } from "../../controllers/chatbot.controller.js";
import {
  ChatbotConversationGetQuerySchema,
  ChatbotConversationIdParamsSchema,
  ChatbotPostMessageBodySchema,
} from "../../validators/chatbot.schemas.js";

const router = Router();

router.use(optionalAuthMiddleware);

router.post(
  "/message",
  validate("body", ChatbotPostMessageBodySchema),
  asyncHandler(chatbotController.postMessage.bind(chatbotController)),
);

router.get(
  "/conversations/:conversationId",
  validate("params", ChatbotConversationIdParamsSchema),
  validate("query", ChatbotConversationGetQuerySchema),
  asyncHandler(chatbotController.getConversation.bind(chatbotController)),
);

router.post(
  "/conversations/:conversationId/close",
  validate("params", ChatbotConversationIdParamsSchema),
  validate("query", ChatbotConversationGetQuerySchema),
  asyncHandler(chatbotController.close.bind(chatbotController)),
);

export { router as chatbotRoutes };
