import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { PaginationQuerySchema } from "../../validators/pagination.schemas.js";
import { customerOrdersController } from "../../controllers/customer-orders.controller.js";

const router = Router();
router.use(authMiddleware);

router.get(
  "/orders",
  requireRoles("CUSTOMER"),
  validate("query", PaginationQuerySchema),
  asyncHandler(customerOrdersController.listMine.bind(customerOrdersController)),
);

export { router as customerRoutes };
