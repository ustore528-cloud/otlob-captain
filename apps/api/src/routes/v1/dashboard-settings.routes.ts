import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { ROLE_GROUPS } from "../../lib/rbac-roles.js";
import { DashboardSettingsPatchSchema } from "../../validators/dashboard-settings.schemas.js";
import { dashboardSettingsController } from "../../controllers/dashboard-settings.controller.js";

const router = Router();
router.use(authMiddleware);
router.get("/", requireRoles(...ROLE_GROUPS.orderOperators), asyncHandler(dashboardSettingsController.get.bind(dashboardSettingsController)));
router.patch(
  "/",
  requireRoles(...ROLE_GROUPS.orderOperators),
  validate("body", DashboardSettingsPatchSchema),
  asyncHandler(dashboardSettingsController.patch.bind(dashboardSettingsController)),
);

export { router as dashboardSettingsRoutes };
