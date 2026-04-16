import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import {
  CreateStoreBodySchema,
  UpdateStoreBodySchema,
  StoreIdParamSchema,
  ListStoresQuerySchema,
} from "../../validators/stores.schemas.js";
import { storesController } from "../../controllers/stores.controller.js";

const router = Router();
router.use(authMiddleware);

router.get(
  "/",
  requireRoles("ADMIN", "DISPATCHER", "STORE"),
  validate("query", ListStoresQuerySchema),
  asyncHandler(storesController.list.bind(storesController)),
);

router.post(
  "/",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("body", CreateStoreBodySchema),
  asyncHandler(storesController.create.bind(storesController)),
);

router.get(
  "/:id",
  requireRoles("ADMIN", "DISPATCHER", "STORE"),
  validate("params", StoreIdParamSchema),
  asyncHandler(storesController.getById.bind(storesController)),
);

router.patch(
  "/:id",
  requireRoles("ADMIN", "DISPATCHER", "STORE"),
  validate("params", StoreIdParamSchema),
  validate("body", UpdateStoreBodySchema),
  asyncHandler(storesController.update.bind(storesController)),
);

export { router as storesRoutes };
