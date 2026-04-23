import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { ROLE_GROUPS } from "../../lib/rbac-roles.js";
import { GeocodePlaceQuerySchema } from "../../validators/geocode.schemas.js";
import { geocodeController } from "../../controllers/geocode.controller.js";

const router = Router();
router.use(authMiddleware);
router.get(
  "/place",
  requireRoles(...ROLE_GROUPS.orderOperators),
  validate("query", GeocodePlaceQuerySchema),
  asyncHandler(geocodeController.place.bind(geocodeController)),
);

export { router as geocodeRoutes };
