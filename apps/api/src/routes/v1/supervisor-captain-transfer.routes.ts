import { Router } from "express";
import { supervisorCaptainTransferController } from "../../controllers/supervisor-captain-transfer.controller.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { SupervisorCaptainTransferBodySchema } from "../../validators/supervisor-captain-transfer.schemas.js";

const router = Router();

router.use(authMiddleware);
/** محفظة المشرف ← كابتن: الأدوار المعتمدة فقط (الباقي ROLE_NOT_SUPPORTED عبر middleware). */
router.use(requireRoles("COMPANY_ADMIN", "SUPER_ADMIN"));

router.post(
  "/transfers/to-captain",
  validate("body", SupervisorCaptainTransferBodySchema),
  asyncHandler(supervisorCaptainTransferController.transferToMyCaptain.bind(supervisorCaptainTransferController)),
);

export { router as supervisorCaptainTransferRoutes };
