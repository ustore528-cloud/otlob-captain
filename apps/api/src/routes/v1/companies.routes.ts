import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { ROLE_GROUPS } from "../../lib/rbac-roles.js";
import { companiesController } from "../../controllers/companies.controller.js";
import {
  CompanyArchiveBodySchema,
  CompanyIdParamSchema,
  CreateCompanyBodySchema,
} from "../../validators/companies.schemas.js";

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(...ROLE_GROUPS.superAdmins));

router.get("/", asyncHandler(companiesController.list.bind(companiesController)));
router.post(
  "/",
  validate("body", CreateCompanyBodySchema),
  asyncHandler(companiesController.create.bind(companiesController)),
);

router.get(
  "/:companyId/delete-preview",
  validate("params", CompanyIdParamSchema),
  asyncHandler(companiesController.deletePreview.bind(companiesController)),
);
router.post(
  "/:companyId/archive",
  validate("params", CompanyIdParamSchema),
  validate("body", CompanyArchiveBodySchema),
  asyncHandler(companiesController.archive.bind(companiesController)),
);

export { router as companiesRoutes };
