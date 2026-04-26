import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { PublicCreateOrderBodySchema, PublicRequestContextParamSchema } from "../../validators/public-request.schemas.js";
import { publicRequestController } from "../../controllers/public-request.controller.js";

const router = Router();

router.get(
  "/request-context/:code",
  validate("params", PublicRequestContextParamSchema),
  asyncHandler(publicRequestController.requestContext.bind(publicRequestController)),
);

router.post(
  "/orders",
  validate("body", PublicCreateOrderBodySchema),
  asyncHandler(publicRequestController.createOrder.bind(publicRequestController)),
);

export { router as publicRoutes };
