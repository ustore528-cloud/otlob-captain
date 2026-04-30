import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { ListZonesQuerySchema } from "../../validators/zones.schemas.js";
import { zonesController } from "../../controllers/zones.controller.js";

const router = Router();
router.use(authMiddleware);

router.get(
  "/",
  requireRoles("SUPER_ADMIN", "COMPANY_ADMIN"),
  validate("query", ListZonesQuerySchema),
  asyncHandler(zonesController.list.bind(zonesController)),
);

export { router as zonesRoutes };
