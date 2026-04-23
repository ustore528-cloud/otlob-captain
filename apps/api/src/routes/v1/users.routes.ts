import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { ROLE_GROUPS, isOrderOperatorRole } from "../../lib/rbac-roles.js";
import {
  UserListQuerySchema,
  UserIdParamSchema,
  UserActiveBodySchema,
  CreateUserBodySchema,
  UpdateCustomerProfileBodySchema,
} from "../../validators/users.schemas.js";
import { usersController } from "../../controllers/users.controller.js";
import { AppError } from "../../utils/errors.js";
import { pathParam } from "../../utils/path-params.js";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requireRoles(...ROLE_GROUPS.orderOperators),
  validate("query", UserListQuerySchema),
  asyncHandler(usersController.list.bind(usersController)),
);

router.post(
  "/",
  requireRoles(...ROLE_GROUPS.superAdmins),
  validate("body", CreateUserBodySchema),
  asyncHandler(usersController.create.bind(usersController)),
);

router.get(
  "/:id",
  validate("params", UserIdParamSchema),
  asyncHandler(async (req, res, next) => {
    if (!isOrderOperatorRole(req.user!.role) && req.user!.id !== pathParam(req, "id")) {
      return next(new AppError(403, "Forbidden", "FORBIDDEN"));
    }
    return usersController.getById(req, res);
  }),
);

router.patch(
  "/:id/active",
  requireRoles(...ROLE_GROUPS.managementAdmins),
  validate("params", UserIdParamSchema),
  validate("body", UserActiveBodySchema),
  asyncHandler(usersController.setActive.bind(usersController)),
);

router.patch(
  "/:id/customer-profile",
  requireRoles(...ROLE_GROUPS.orderOperators),
  validate("params", UserIdParamSchema),
  validate("body", UpdateCustomerProfileBodySchema),
  asyncHandler(usersController.updateCustomerProfile.bind(usersController)),
);

export { router as usersRoutes };
