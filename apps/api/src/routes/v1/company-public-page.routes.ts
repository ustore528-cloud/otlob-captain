import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { companyPublicPageController } from "../../controllers/company-public-page.controller.js";

const router = Router();

const companyPublicPageGuards = [authMiddleware, requireRoles("COMPANY_ADMIN")] as const;

router.get(
  "/company/public-page-settings/me",
  ...companyPublicPageGuards,
  asyncHandler(companyPublicPageController.get.bind(companyPublicPageController)),
);
router.patch(
  "/company/public-page-settings/me",
  ...companyPublicPageGuards,
  asyncHandler(companyPublicPageController.patch.bind(companyPublicPageController)),
);

export { router as companyPublicPageRoutes };
