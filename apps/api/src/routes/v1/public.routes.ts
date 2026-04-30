import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  PublicCreateOrderBodySchema,
  PublicNearbyCaptainsParamsSchema,
  PublicNearbyCaptainsQuerySchema,
  PublicOrderTrackingParamsSchema,
  PublicOrderTrackingQuerySchema,
  PublicRequestContextParamSchema,
} from "../../validators/public-request.schemas.js";
import {
  PublicComplaintBodySchema,
  PublicComplaintParamsSchema,
} from "../../validators/complaints.schemas.js";
import { GeocodeReverseQuerySchema } from "../../validators/geocode.schemas.js";
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

router.post(
  "/request-pages/:ownerCode/complaints",
  validate("params", PublicComplaintParamsSchema),
  validate("body", PublicComplaintBodySchema),
  asyncHandler(publicRequestController.submitComplaint.bind(publicRequestController)),
);

router.get(
  "/geocode/reverse",
  validate("query", GeocodeReverseQuerySchema),
  asyncHandler(publicRequestController.reverseGeocode.bind(publicRequestController)),
);

router.get(
  "/nearby-captains/:code",
  validate("params", PublicNearbyCaptainsParamsSchema),
  validate("query", PublicNearbyCaptainsQuerySchema),
  asyncHandler(publicRequestController.nearbyCaptains.bind(publicRequestController)),
);

router.get(
  "/order-tracking/:ownerCode/:orderId",
  validate("params", PublicOrderTrackingParamsSchema),
  validate("query", PublicOrderTrackingQuerySchema),
  asyncHandler(publicRequestController.orderTracking.bind(publicRequestController)),
);

export { router as publicRoutes };
