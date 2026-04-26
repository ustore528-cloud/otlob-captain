import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { ROLE_GROUPS } from "../../lib/rbac-roles.js";
import {
  CreateStoreBodySchema,
  UpdateStoreBodySchema,
  StoreIdParamSchema,
  ListStoresQuerySchema,
} from "../../validators/stores.schemas.js";
import { storesController } from "../../controllers/stores.controller.js";

const router = Router();
router.use(authMiddleware);

/** company-scoped list for `COMPANY_ADMIN` + full list for `SUPER_ADMIN` (see `storesService.list`). */
router.get(
  "/",
  requireRoles(...ROLE_GROUPS.orderOperators),
  validate("query", ListStoresQuerySchema),
  asyncHandler(storesController.list.bind(storesController)),
);

router.post(
  "/",
  requireRoles(...ROLE_GROUPS.superAdmins),
  validate("body", CreateStoreBodySchema),
  asyncHandler(storesController.create.bind(storesController)),
);

router.get(
  "/:id",
  requireRoles(...ROLE_GROUPS.superAdmins),
  validate("params", StoreIdParamSchema),
  asyncHandler(storesController.getById.bind(storesController)),
);

router.patch(
  "/:id",
  requireRoles(...ROLE_GROUPS.superAdmins),
  validate("params", StoreIdParamSchema),
  validate("body", UpdateStoreBodySchema),
  asyncHandler(storesController.update.bind(storesController)),
);

export { router as storesRoutes };
