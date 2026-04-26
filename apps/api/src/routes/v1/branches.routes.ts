import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { ListBranchesQuerySchema } from "../../validators/branches.schemas.js";
import { branchesController } from "../../controllers/branches.controller.js";

const router = Router();
router.use(authMiddleware);

router.get(
  "/",
  requireRoles("SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "BRANCH_MANAGER"),
  validate("query", ListBranchesQuerySchema),
  asyncHandler(branchesController.list.bind(branchesController)),
);

export { router as branchesRoutes };
