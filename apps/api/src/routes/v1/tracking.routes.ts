import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { ROLE_GROUPS } from "../../lib/rbac-roles.js";
import { CaptainLocationBodySchema, LatestLocationsQuerySchema } from "../../validators/tracking.schemas.js";
import { trackingController } from "../../controllers/tracking.controller.js";

const router = Router();
router.use(authMiddleware);

router.post(
  "/me/location",
  requireRoles(...ROLE_GROUPS.captains),
  validate("body", CaptainLocationBodySchema),
  asyncHandler(trackingController.updateMyLocation.bind(trackingController)),
);

router.get(
  "/locations/latest",
  requireRoles(...ROLE_GROUPS.orderOperators),
  validate("query", LatestLocationsQuerySchema),
  asyncHandler(trackingController.latestLocations.bind(trackingController)),
);

router.get(
  "/captains/active-map",
  requireRoles(...ROLE_GROUPS.orderOperators),
  asyncHandler(trackingController.activeMap.bind(trackingController)),
);

export { router as trackingRoutes };
