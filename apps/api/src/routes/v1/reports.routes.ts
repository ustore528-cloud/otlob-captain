import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { rolesWithCapability } from "../../rbac/permissions.js";
import { reportsController } from "../../controllers/reports.controller.js";
import {
  DeliveredCommissionsQuerySchema,
  OrdersHistoryQuerySchema,
  ReportsDateRangeQuerySchema,
} from "../../validators/reports.schemas.js";

const router = Router();
router.use(authMiddleware);

const reportsReadRoles = rolesWithCapability("reports.read");

router.get(
  "/reconciliation-summary",
  requireRoles(...reportsReadRoles),
  validate("query", ReportsDateRangeQuerySchema),
  asyncHandler(reportsController.reconciliationSummary.bind(reportsController)),
);

router.get(
  "/delivered-commissions",
  requireRoles(...reportsReadRoles),
  validate("query", DeliveredCommissionsQuerySchema),
  asyncHandler(reportsController.deliveredCommissions.bind(reportsController)),
);

router.get(
  "/orders-history",
  requireRoles(...reportsReadRoles),
  validate("query", OrdersHistoryQuerySchema),
  asyncHandler(reportsController.ordersHistory.bind(reportsController)),
);

export { router as reportsRoutes };
