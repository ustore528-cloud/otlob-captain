import type { Request, Response } from "express";
import type { AssignmentType } from "@prisma/client";
import { $Enums } from "@prisma/client";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import { ordersService } from "../services/orders.service.js";
import { distributionService } from "../services/distribution/index.js";

const actor = (req: Request) => ({
  userId: req.user!.id,
  role: req.user!.role,
  storeId: req.user!.storeId,
});

export const ordersController = {
  create: async (req: Request, res: Response) => {
    const data = await ordersService.create(req.body as Parameters<typeof ordersService.create>[0], actor(req));
    return res.status(201).json(ok(data));
  },

  list: async (req: Request, res: Response) => {
    const q = req.query as Record<string, string | undefined>;
    const data = await ordersService.list(
      {
        storeId: q.storeId,
        status: q.status as never,
        area: q.area,
        orderNumber: q.orderNumber,
        customerPhone: q.customerPhone,
        page: Number(q.page) || 1,
        pageSize: Number(q.pageSize) || 20,
      },
      actor(req),
    );
    return res.json(ok(data));
  },

  getById: async (req: Request, res: Response) => {
    const data = await ordersService.getById(pathParam(req, "id"), actor(req));
    return res.json(ok(data));
  },

  updateStatus: async (req: Request, res: Response) => {
    const body = req.body as { status: import("@prisma/client").OrderStatus };
    const data = await ordersService.updateStatus(pathParam(req, "id"), body.status, actor(req));
    return res.json(ok(data));
  },

  accept: async (req: Request, res: Response) => {
    const data = await ordersService.acceptByCaptain(pathParam(req, "id"), req.user!.id);
    return res.json(ok(data));
  },

  reject: async (req: Request, res: Response) => {
    const data = await ordersService.rejectByCaptain(pathParam(req, "id"), req.user!.id);
    return res.json(ok(data));
  },

  reassign: async (req: Request, res: Response) => {
    const body = req.body as { captainId: string };
    const data = await distributionService.reassign(pathParam(req, "id"), body.captainId, req.user!.id);
    return res.json(ok(data));
  },

  startAutoDistribution: async (req: Request, res: Response) => {
    const data = await distributionService.startAuto(pathParam(req, "id"), req.user!.id);
    return res.json(ok(data));
  },

  resendDistribution: async (req: Request, res: Response) => {
    const data = await distributionService.resendToDistribution(pathParam(req, "id"), req.user!.id);
    return res.json(ok(data));
  },

  cancelCaptainAssignment: async (req: Request, res: Response) => {
    const data = await distributionService.cancelCaptainAssignment(pathParam(req, "id"), req.user!.id);
    return res.json(ok(data));
  },

  manualAssign: async (req: Request, res: Response) => {
    const body = req.body as { captainId: string; assignmentType?: AssignmentType };
    const mode =
      body.assignmentType === $Enums.AssignmentType.DRAG_DROP
        ? $Enums.AssignmentType.DRAG_DROP
        : $Enums.AssignmentType.MANUAL;
    const data = await distributionService.assignManual(pathParam(req, "id"), body.captainId, req.user!.id, mode);
    return res.json(ok(data));
  },

  /** تعيين من لوحة السحب والإفلات — يسجل DRAG_DROP في OrderAssignmentLog */
  dragDropAssign: async (req: Request, res: Response) => {
    const body = req.body as { captainId: string };
    const data = await distributionService.assignManual(
      pathParam(req, "id"),
      body.captainId,
      req.user!.id,
      $Enums.AssignmentType.DRAG_DROP,
    );
    return res.json(ok(data));
  },
};
