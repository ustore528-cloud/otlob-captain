import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { ROLE_GROUPS } from "../../lib/rbac-roles.js";
import {
  AdminCaptainApplicationIdParamsSchema,
  AdminCaptainApplicationsQuerySchema,
  AdminCaptainApplicationStatusBodySchema,
} from "../../validators/captain-application.schemas.js";
import { captainApplicationController } from "../../controllers/captain-application.controller.js";

const router = Router();
router.use(authMiddleware);
router.use(requireRoles(...ROLE_GROUPS.superAdmins));

router.get(
  "/",
  validate("query", AdminCaptainApplicationsQuerySchema),
  asyncHandler(captainApplicationController.listSuperAdmin.bind(captainApplicationController)),
);

router.patch(
  "/:id/status",
  validate("params", AdminCaptainApplicationIdParamsSchema),
  validate("body", AdminCaptainApplicationStatusBodySchema),
  asyncHandler(captainApplicationController.patchStatusSuperAdmin.bind(captainApplicationController)),
);

export { router as adminCaptainApplicationsRoutes };
