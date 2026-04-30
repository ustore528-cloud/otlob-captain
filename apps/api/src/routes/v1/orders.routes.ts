import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { ROLE_GROUPS, type AppRole } from "../../lib/rbac-roles.js";
import { rolesWithCapability } from "../../rbac/permissions.js";
import {
  CreateOrderBodySchema,
  ListOrdersQuerySchema,
  OrderIdParamSchema,
  UpdateOrderStatusBodySchema,
  ReassignBodySchema,
  ManualAssignBodySchema,
  DragDropAssignBodySchema,
  AutoAssignVisibleBodySchema,
  AdminOverrideOrderStatusBodySchema,
} from "../../validators/orders.schemas.js";
import { ordersController } from "../../controllers/orders.controller.js";

const router = Router();
const ordersReadRoles = rolesWithCapability("orders.read");
const ordersCreateRoles = rolesWithCapability("orders.create");
const ordersDispatchRoles = rolesWithCapability("orders.dispatch");
/** PATCH حالة الطلب لا يعتمد ضمنياً على `orders.read` (الكابتن ليس إدارياً؛ صراحية أدوار فقط). */
const orderStatusPatchRoles = ["SUPER_ADMIN", "COMPANY_ADMIN", "CAPTAIN"] as const satisfies readonly AppRole[];

router.use(authMiddleware);

router.post(
  "/",
  requireRoles(...ordersCreateRoles),
  validate("body", CreateOrderBodySchema),
  asyncHandler(ordersController.create.bind(ordersController)),
);

router.get(
  "/",
  requireRoles(...ordersReadRoles),
  validate("query", ListOrdersQuerySchema),
  asyncHandler(ordersController.list.bind(ordersController)),
);

router.post(
  "/:id/archive",
  requireRoles(...ordersDispatchRoles),
  validate("params", OrderIdParamSchema),
  asyncHandler(ordersController.archiveOrder.bind(ordersController)),
);

router.post(
  "/:id/unarchive",
  requireRoles(...ordersDispatchRoles),
  validate("params", OrderIdParamSchema),
  asyncHandler(ordersController.unarchiveOrder.bind(ordersController)),
);

/** Canonical manual override — must match `paths.orders.adminOverrideStatus` in `@captain/shared`. */
router.post(
  "/:id/override-status",
  requireRoles(...ordersDispatchRoles),
  validate("params", OrderIdParamSchema),
  validate("body", AdminOverrideOrderStatusBodySchema),
  asyncHandler(ordersController.adminOverrideOrderStatus.bind(ordersController)),
);

/** Legacy alias — same handler (older clients / docs). */
router.post(
  "/:id/admin-override-status",
  requireRoles(...ordersDispatchRoles),
  validate("params", OrderIdParamSchema),
  validate("body", AdminOverrideOrderStatusBodySchema),
  asyncHandler(ordersController.adminOverrideOrderStatus.bind(ordersController)),
);

router.get(
  "/:id",
  requireRoles(...ordersReadRoles),
  validate("params", OrderIdParamSchema),
  asyncHandler(ordersController.getById.bind(ordersController)),
);

router.patch(
  "/:id/status",
  requireRoles(...orderStatusPatchRoles),
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
  requireRoles(...ordersDispatchRoles),
  validate("params", OrderIdParamSchema),
  validate("body", ReassignBodySchema),
  asyncHandler(ordersController.reassign.bind(ordersController)),
);

router.post(
  "/distribution/auto-assign-visible",
  requireRoles(...ordersDispatchRoles),
  validate("body", AutoAssignVisibleBodySchema),
  asyncHandler(ordersController.autoAssignVisible.bind(ordersController)),
);

router.post(
  "/:id/distribution/auto",
  requireRoles(...ordersDispatchRoles),
  validate("params", OrderIdParamSchema),
  asyncHandler(ordersController.startAutoDistribution.bind(ordersController)),
);

router.post(
  "/:id/distribution/resend",
  requireRoles(...ordersDispatchRoles),
  validate("params", OrderIdParamSchema),
  asyncHandler(ordersController.resendDistribution.bind(ordersController)),
);

router.post(
  "/:id/distribution/cancel-captain",
  requireRoles(...ordersDispatchRoles),
  validate("params", OrderIdParamSchema),
  asyncHandler(ordersController.cancelCaptainAssignment.bind(ordersController)),
);

router.post(
  "/:id/distribution/manual",
  requireRoles(...ordersDispatchRoles),
  validate("params", OrderIdParamSchema),
  validate("body", ManualAssignBodySchema),
  asyncHandler(ordersController.manualAssign.bind(ordersController)),
);

router.post(
  "/:id/distribution/drag-drop",
  requireRoles(...ordersDispatchRoles),
  validate("params", OrderIdParamSchema),
  validate("body", DragDropAssignBodySchema),
  asyncHandler(ordersController.dragDropAssign.bind(ordersController)),
);

export { router as ordersRoutes };
