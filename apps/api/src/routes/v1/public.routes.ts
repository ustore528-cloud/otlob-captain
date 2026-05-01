import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  PublicCreateOrderBodySchema,
  PublicNearbyCaptainsParamsSchema,
  PublicNearbyCaptainsQuerySchema,
  PublicOrderByTrackingTokenParamsSchema,
  PublicOrderTrackingParamsSchema,
  PublicOrderTrackingQuerySchema,
  PublicRequestContextParamSchema,
  PublicWebPushSubscribeBodySchema,
  PublicWebPushSubscribeByTokenBodySchema,
  PublicWebPushSubscribeByTokenParamsSchema,
} from "../../validators/public-request.schemas.js";
import {
  PublicComplaintBodySchema,
  PublicComplaintParamsSchema,
} from "../../validators/complaints.schemas.js";
import { GeocodeReverseQuerySchema } from "../../validators/geocode.schemas.js";
import { PublicCaptainApplicationCreateBodySchema } from "../../validators/captain-application.schemas.js";
import { captainApplicationController } from "../../controllers/captain-application.controller.js";
import { publicRequestController } from "../../controllers/public-request.controller.js";

const router = Router();

router.post(
  "/captain-applications",
  validate("body", PublicCaptainApplicationCreateBodySchema),
  asyncHandler(captainApplicationController.createPublic.bind(captainApplicationController)),
);

router.get(
  "/request-context/:code",
  validate("params", PublicRequestContextParamSchema),
  asyncHandler(publicRequestController.requestContext.bind(publicRequestController)),
);

router.get(
  "/web-push/public-key",
  asyncHandler(publicRequestController.pushWebVapidPublicKey.bind(publicRequestController)),
);

router.post(
  "/orders/:trackingToken/push-subscription",
  validate("params", PublicWebPushSubscribeByTokenParamsSchema),
  validate("body", PublicWebPushSubscribeByTokenBodySchema),
  asyncHandler(publicRequestController.subscribePublicWebPushByTrackingToken.bind(publicRequestController)),
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

router.get(
  "/order-by-tracking-token/:trackingToken",
  validate("params", PublicOrderByTrackingTokenParamsSchema),
  asyncHandler(publicRequestController.orderIdsByTrackingToken.bind(publicRequestController)),
);

router.get(
  "/push/web/vapid-public-key",
  asyncHandler(publicRequestController.pushWebVapidPublicKey.bind(publicRequestController)),
);

router.post(
  "/push/web/subscribe",
  validate("body", PublicWebPushSubscribeBodySchema),
  asyncHandler(publicRequestController.subscribePublicWebPush.bind(publicRequestController)),
);

export { router as publicRoutes };
