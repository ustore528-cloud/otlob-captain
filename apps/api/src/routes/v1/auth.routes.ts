import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { LoginBodySchema, RefreshBodySchema, RegisterBodySchema } from "../../validators/auth.schemas.js";
import { authController } from "../../controllers/auth.controller.js";

const router = Router();

router.post("/login", validate("body", LoginBodySchema), asyncHandler(authController.login.bind(authController)));
router.post("/refresh", validate("body", RefreshBodySchema), asyncHandler(authController.refresh.bind(authController)));
router.get("/me", authMiddleware, asyncHandler(authController.me.bind(authController)));
router.post(
  "/register",
  validate("body", RegisterBodySchema),
  authMiddleware,
  requireRoles("ADMIN"),
  asyncHandler(authController.register.bind(authController)),
);

export { router as authRoutes };
