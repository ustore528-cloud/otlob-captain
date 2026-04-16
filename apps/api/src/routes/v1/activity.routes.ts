import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { ActivityListQuerySchema } from "../../validators/activity.schemas.js";
import { activityController } from "../../controllers/activity.controller.js";

const router = Router();
router.use(authMiddleware);
router.get(
  "/",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("query", ActivityListQuerySchema),
  asyncHandler(activityController.list.bind(activityController)),
);

export { router as activityRoutes };
