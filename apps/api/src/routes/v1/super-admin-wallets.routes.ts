import { Router } from "express";
import { superAdminWalletsController } from "../../controllers/super-admin-wallets.controller.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { ROLE_GROUPS } from "../../lib/rbac-roles.js";
import {
  SuperAdminCompanyIdParamSchema,
  SuperAdminCompanyWalletTopUpBodySchema,
  SuperAdminStoreIdParamSchema,
  SuperAdminSupervisorWalletAdjustmentBodySchema,
  SuperAdminSupervisorUserIdParamSchema,
  SuperAdminWalletTopUpBodySchema,
} from "../../validators/super-admin-wallets.schemas.js";

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(...ROLE_GROUPS.superAdmins));

router.post(
  "/company/:companyId/top-up",
  validate("params", SuperAdminCompanyIdParamSchema),
  validate("body", SuperAdminCompanyWalletTopUpBodySchema),
  asyncHandler(superAdminWalletsController.topUpCompany.bind(superAdminWalletsController)),
);

router.post(
  "/stores/:storeId/top-up",
  validate("params", SuperAdminStoreIdParamSchema),
  validate("body", SuperAdminWalletTopUpBodySchema),
  asyncHandler(superAdminWalletsController.topUpStore.bind(superAdminWalletsController)),
);

router.post(
  "/supervisor-users/:userId/top-up",
  validate("params", SuperAdminSupervisorUserIdParamSchema),
  validate("body", SuperAdminWalletTopUpBodySchema),
  asyncHandler(superAdminWalletsController.topUpSupervisorUser.bind(superAdminWalletsController)),
);

router.post(
  "/supervisor-users/:userId/adjustment",
  validate("params", SuperAdminSupervisorUserIdParamSchema),
  validate("body", SuperAdminSupervisorWalletAdjustmentBodySchema),
  asyncHandler(superAdminWalletsController.adjustSupervisorUser.bind(superAdminWalletsController)),
);

export { router as superAdminWalletsRoutes };
