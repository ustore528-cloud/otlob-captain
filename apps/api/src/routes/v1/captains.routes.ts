import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { UserActiveBodySchema } from "../../validators/users.schemas.js";
import {
  CreateCaptainBodySchema,
  UpdateCaptainBodySchema,
  CaptainIdParamSchema,
  ListCaptainsQuerySchema,
  CaptainAvailabilityBodySchema,
} from "../../validators/captains.schemas.js";
import { captainsController } from "../../controllers/captains.controller.js";
import { captainRepository } from "../../repositories/captain.repository.js";
import { captainsService } from "../../services/captains.service.js";
import { AppError } from "../../utils/errors.js";
import { ok } from "../../utils/api-response.js";
import { pathParam } from "../../utils/path-params.js";

const router = Router();
router.use(authMiddleware);

router.get(
  "/",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("query", ListCaptainsQuerySchema),
  asyncHandler(captainsController.list.bind(captainsController)),
);

router.post(
  "/",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("body", CreateCaptainBodySchema),
  asyncHandler(captainsController.create.bind(captainsController)),
);

router.get(
  "/me",
  requireRoles("CAPTAIN"),
  asyncHandler(async (req, res) => {
    const cap = await captainRepository.findByUserId(req.user!.id);
    if (!cap) throw new AppError(404, "Captain profile not found", "NOT_FOUND");
    return res.json(ok(cap));
  }),
);

router.patch(
  "/me/availability",
  requireRoles("CAPTAIN"),
  validate("body", CaptainAvailabilityBodySchema),
  asyncHandler(async (req, res) => {
    const cap = await captainRepository.findByUserId(req.user!.id);
    if (!cap) throw new AppError(404, "Captain profile not found", "NOT_FOUND");
    const body = req.body as { availabilityStatus: import("@prisma/client").CaptainAvailabilityStatus };
    const data = await captainsService.setAvailability(cap.id, req.user!.id, body.availabilityStatus, req.user!.id, {
      role: req.user!.role,
    });
    return res.json(ok(data));
  }),
);

router.get(
  "/:id",
  requireRoles("ADMIN", "DISPATCHER", "CAPTAIN"),
  validate("params", CaptainIdParamSchema),
  asyncHandler(async (req, res, next) => {
    if (req.user!.role === "CAPTAIN") {
      const cap = await captainRepository.findByUserId(req.user!.id);
      if (!cap || cap.id !== pathParam(req, "id")) return next(new AppError(403, "Forbidden", "FORBIDDEN"));
    }
    return captainsController.getById(req, res);
  }),
);

router.patch(
  "/:id",
  requireRoles("ADMIN", "DISPATCHER", "CAPTAIN"),
  validate("params", CaptainIdParamSchema),
  validate("body", UpdateCaptainBodySchema),
  asyncHandler(captainsController.update.bind(captainsController)),
);

router.patch(
  "/:id/active",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("params", CaptainIdParamSchema),
  validate("body", UserActiveBodySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { isActive: boolean };
    const data = await captainsService.setActive(pathParam(req, "id"), body.isActive, req.user!.id);
    return res.json(ok(data));
  }),
);

router.patch(
  "/:id/availability",
  requireRoles("ADMIN", "DISPATCHER"),
  validate("params", CaptainIdParamSchema),
  validate("body", CaptainAvailabilityBodySchema),
  asyncHandler(captainsController.setAvailability.bind(captainsController)),
);

router.get(
  "/:id/stats",
  requireRoles("ADMIN", "DISPATCHER", "CAPTAIN"),
  validate("params", CaptainIdParamSchema),
  asyncHandler(async (req, res, next) => {
    if (req.user!.role === "CAPTAIN") {
      const cap = await captainRepository.findByUserId(req.user!.id);
      if (!cap || cap.id !== pathParam(req, "id")) return next(new AppError(403, "Forbidden", "FORBIDDEN"));
    }
    return captainsController.stats(req, res);
  }),
);

export { router as captainsRoutes };
