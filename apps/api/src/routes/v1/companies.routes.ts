import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { ROLE_GROUPS } from "../../lib/rbac-roles.js";
import { companiesController } from "../../controllers/companies.controller.js";

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(...ROLE_GROUPS.superAdmins));

router.get("/", asyncHandler(companiesController.list.bind(companiesController)));

export { router as companiesRoutes };
