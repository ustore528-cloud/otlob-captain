import { Router } from "express";
import { asyncHandler } from "../../../utils/async-handler.js";
import { validate } from "../../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../../middlewares/auth.middleware.js";
import { requireRoles } from "../../../middlewares/rbac.middleware.js";
import { CaptainLocationBodySchema } from "../../../validators/tracking.schemas.js";
import {
  MobileCaptainLoginBodySchema,
  MobileCaptainRefreshBodySchema,
  MobileCaptainOrderIdParamSchema,
  MobileCaptainOrderStatusBodySchema,
  MobileCaptainOrderHistoryQuerySchema,
  MobileCaptainEarningsQuerySchema,
  MobileCaptainAvailabilityBodySchema,
} from "../../../validators/mobile-captain.schemas.js";
import { mobileCaptainController } from "../../../controllers/mobile-captain.controller.js";

const captainMobileRoutes = Router();

captainMobileRoutes.post(
  "/auth/login",
  validate("body", MobileCaptainLoginBodySchema),
  asyncHandler(mobileCaptainController.login.bind(mobileCaptainController)),
);

captainMobileRoutes.post(
  "/auth/refresh",
  validate("body", MobileCaptainRefreshBodySchema),
  asyncHandler(mobileCaptainController.refresh.bind(mobileCaptainController)),
);

captainMobileRoutes.use(authMiddleware, requireRoles("CAPTAIN"));

captainMobileRoutes.get("/me", asyncHandler(mobileCaptainController.me.bind(mobileCaptainController)));

captainMobileRoutes.get(
  "/me/work-status",
  asyncHandler(mobileCaptainController.workStatus.bind(mobileCaptainController)),
);

captainMobileRoutes.get(
  "/me/assignment",
  asyncHandler(mobileCaptainController.currentAssignment.bind(mobileCaptainController)),
);

captainMobileRoutes.patch(
  "/me/availability",
  validate("body", MobileCaptainAvailabilityBodySchema),
  asyncHandler(mobileCaptainController.updateAvailability.bind(mobileCaptainController)),
);

captainMobileRoutes.get(
  "/orders/history",
  validate("query", MobileCaptainOrderHistoryQuerySchema),
  asyncHandler(mobileCaptainController.orderHistory.bind(mobileCaptainController)),
);

captainMobileRoutes.get(
  "/orders/:orderId",
  validate("params", MobileCaptainOrderIdParamSchema),
  asyncHandler(mobileCaptainController.getOrderById.bind(mobileCaptainController)),
);

captainMobileRoutes.post(
  "/orders/:orderId/accept",
  validate("params", MobileCaptainOrderIdParamSchema),
  asyncHandler(mobileCaptainController.acceptOrder.bind(mobileCaptainController)),
);

captainMobileRoutes.post(
  "/orders/:orderId/reject",
  validate("params", MobileCaptainOrderIdParamSchema),
  asyncHandler(mobileCaptainController.rejectOrder.bind(mobileCaptainController)),
);

captainMobileRoutes.patch(
  "/orders/:orderId/status",
  validate("params", MobileCaptainOrderIdParamSchema),
  validate("body", MobileCaptainOrderStatusBodySchema),
  asyncHandler(mobileCaptainController.updateOrderStatus.bind(mobileCaptainController)),
);

captainMobileRoutes.post(
  "/me/location",
  validate("body", CaptainLocationBodySchema),
  asyncHandler(mobileCaptainController.updateLocation.bind(mobileCaptainController)),
);

captainMobileRoutes.get(
  "/earnings/summary",
  validate("query", MobileCaptainEarningsQuerySchema),
  asyncHandler(mobileCaptainController.earningsSummary.bind(mobileCaptainController)),
);

export { captainMobileRoutes };
