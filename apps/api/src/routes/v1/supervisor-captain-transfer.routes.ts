import { Router } from "express";
import { UserRole } from "@prisma/client";
import { supervisorCaptainTransferController } from "../../controllers/supervisor-captain-transfer.controller.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { SupervisorCaptainTransferBodySchema } from "../../validators/supervisor-captain-transfer.schemas.js";

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(UserRole.BRANCH_MANAGER, UserRole.DISPATCHER));

router.post(
  "/transfers/to-captain",
  validate("body", SupervisorCaptainTransferBodySchema),
  asyncHandler(supervisorCaptainTransferController.transferToMyCaptain.bind(supervisorCaptainTransferController)),
);

export { router as supervisorCaptainTransferRoutes };
