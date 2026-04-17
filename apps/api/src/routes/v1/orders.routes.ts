import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import {
  CreateOrderBodySchema,
  ListOrdersQuerySchema,
  OrderIdParamSchema,
  UpdateOrderStatusBodySchema,
  ReassignBodySchema,
  ManualAssignBodySchema,
  DragDropAssignBodySchema,
} from "../../validators/orders.schemas.js";
import { ordersController } from "../../controllers/orders.controller.js";

const router = Router();
router.use(authMiddleware);

router.post(
  "/",
  requireRoles("ADMIN", "DISPATCHER", "STORE"),
  validate("body", CreateOrderBodySchema),
  asyncHandler(ordersController.create.bind(ordersController)),
);

router.get(
  "/",
  requireRoles("ADMIN", "DISPATCHER", "STORE"),
  validate("query", ListOrdersQuerySchema),
  asyncHandler(ordersController.list.bind(ordersController)),
);

router.get(
  "/:id",
  requireRoles("ADMIN", "DISPATCHER", "STORE", "CAPTAIN"),
  validate("params", OrderIdParamSchema),
  asyncHandler(ordersController.getById.bind(ordersController)),
);

router.patch(
  "/:id/status",
  requireRoles("ADMIN", "DISPATCHER", "STORE", "CAPTAIN"),
  validate("params", OrderIdParamSchema),
  validate("body", UpdateOrderStatusBodySchema),
  asyncHandler(ordersController.updateStatus.bind(ordersController)),
);

router.post(
  "/:id/accept",
  requireRoles("CAPTAIN"),
  validate("params", OrderIdParamSchema),
  asyncHandler(ordersController.accept.bind(ordersController)),
);

router.post(
  "/:id/reject",
  requireRoles("CAPTAIN"),
  validate("params", OrderIdParamSchema),
  asyncHandler(ordersController.reject.bind(ordersController)),
);

router.post(
  "/:id/reassign",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("params", OrderIdParamSchema),
  validate("body", ReassignBodySchema),
  asyncHandler(ordersController.reassign.bind(ordersController)),
);

router.post(
  "/:id/distribution/auto",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("params", OrderIdParamSchema),
  asyncHandler(ordersController.startAutoDistribution.bind(ordersController)),
);

router.post(
  "/:id/distribution/resend",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("params", OrderIdParamSchema),
  asyncHandler(ordersController.resendDistribution.bind(ordersController)),
);

router.post(
  "/:id/distribution/cancel-captain",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("params", OrderIdParamSchema),
  asyncHandler(ordersController.cancelCaptainAssignment.bind(ordersController)),
);

router.post(
  "/:id/distribution/manual",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("params", OrderIdParamSchema),
  validate("body", ManualAssignBodySchema),
  asyncHandler(ordersController.manualAssign.bind(ordersController)),
);

router.post(
  "/:id/distribution/drag-drop",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("params", OrderIdParamSchema),
  validate("body", DragDropAssignBodySchema),
  asyncHandler(ordersController.dragDropAssign.bind(ordersController)),
);

export { router as ordersRoutes };
