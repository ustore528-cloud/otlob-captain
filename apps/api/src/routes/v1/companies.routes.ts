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
  UpdateCompanyBodySchema,
} from "../../validators/companies.schemas.js";
import { PublicPageCarouselSlidesPatchSchema } from "../../services/public-page-settings.js";

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(...ROLE_GROUPS.superAdmins));

router.get(
  "/:companyId/public-page-settings",
  validate("params", CompanyIdParamSchema),
  asyncHandler(companiesController.publicPageSettings.bind(companiesController)),
);
router.patch(
  "/:companyId/public-page-carousel",
  validate("params", CompanyIdParamSchema),
  validate("body", PublicPageCarouselSlidesPatchSchema),
  asyncHandler(companiesController.patchPublicPageCarousel.bind(companiesController)),
);

router.get("/", asyncHandler(companiesController.list.bind(companiesController)));
router.post(
  "/",
  validate("body", CreateCompanyBodySchema),
  asyncHandler(companiesController.create.bind(companiesController)),
);
router.patch(
  "/:companyId",
  validate("params", CompanyIdParamSchema),
  validate("body", UpdateCompanyBodySchema),
  asyncHandler(companiesController.update.bind(companiesController)),
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
