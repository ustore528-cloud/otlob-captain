import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import {
  CreateNotificationBodySchema,
  NotificationIdParamSchema,
  ListNotificationsQuerySchema,
  QuickStatusAlertBodySchema,
} from "../../validators/notifications.schemas.js";
import { notificationsController } from "../../controllers/notifications.controller.js";

const router = Router();
router.use(authMiddleware);

router.post(
  "/",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("body", CreateNotificationBodySchema),
  asyncHandler(notificationsController.create.bind(notificationsController)),
);

router.post(
  "/quick-status",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("body", QuickStatusAlertBodySchema),
  asyncHandler(notificationsController.quickStatusAlert.bind(notificationsController)),
);

router.get(
  "/",
  validate("query", ListNotificationsQuerySchema),
  asyncHandler(notificationsController.listMine.bind(notificationsController)),
);

router.patch(
  "/:id/read",
  validate("params", NotificationIdParamSchema),
  asyncHandler(notificationsController.markRead.bind(notificationsController)),
);

router.post("/read-all", asyncHandler(notificationsController.markAllRead.bind(notificationsController)));

export { router as notificationsRoutes };
