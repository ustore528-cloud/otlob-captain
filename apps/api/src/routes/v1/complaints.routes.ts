import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { complaintsController } from "../../controllers/complaints.controller.js";
import { ComplaintPatchStatusSchema, StaffComplaintIdParamsSchema } from "../../validators/complaints.schemas.js";

const router = Router();

router.use(authMiddleware);
router.use(requireRoles("SUPER_ADMIN", "COMPANY_ADMIN"));

router.get("/", asyncHandler(complaintsController.list.bind(complaintsController)));
router.patch(
  "/:id/status",
  validate("params", StaffComplaintIdParamsSchema),
  validate("body", ComplaintPatchStatusSchema),
  asyncHandler(complaintsController.patchStatus.bind(complaintsController)),
);

export { router as complaintsRoutes };
