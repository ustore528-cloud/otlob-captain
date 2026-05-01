import type { Request, Response } from "express";
import type { AssignmentType } from "@prisma/client";
import { $Enums } from "@prisma/client";
import type { AppRole } from "../lib/rbac-roles.js";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import { ordersService } from "../services/orders.service.js";
import { toOrderListItemDto } from "../dto/order.dto.js";
import { distributionService } from "../services/distribution/index.js";

const actor = (req: Request) => ({
  userId: req.user!.id,
  role: req.user!.role as AppRole,
  storeId: req.user!.storeId,
  companyId: req.user!.companyId ?? null,
  branchId: req.user!.branchId ?? null,
});

function logOrderActionControllerTiming(
  action: "manual_assign" | "resend_distribution" | "reassign",
  phase: string,
  meta: Record<string, unknown>,
): void {
  // eslint-disable-next-line no-console
  console.info("[orders-action-timing]", {
    layer: "orders_controller",
    action,
    phase,
    at: new Date().toISOString(),
    ...meta,
  });
}

function createRequestId(action: "manual_assign" | "resend_distribution" | "reassign"): string {
  return `${action}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const ordersController = {
  create: async (req: Request, res: Response) => {
    const order = await ordersService.create(req.body as Parameters<typeof ordersService.create>[0], actor(req));
    return res.status(201).json(ok(toOrderListItemDto(order)));
  },

  archiveOrder: async (req: Request, res: Response) => {
    const data = await ordersService.archiveOrder(pathParam(req, "id"), actor(req));
    return res.json(ok(data));
  },

  unarchiveOrder: async (req: Request, res: Response) => {
    const data = await ordersService.unarchiveOrder(pathParam(req, "id"), actor(req));
    return res.json(ok(data));
  },

  adminOverrideOrderStatus: async (req: Request, res: Response) => {
    const body = req.body as { status: import("@prisma/client").OrderStatus };
    const data = await ordersService.adminOverrideOrderStatus(pathParam(req, "id"), body.status, {
      userId: req.user!.id,
      role: req.user!.role as AppRole,
      companyId: req.user!.companyId ?? null,
      branchId: req.user!.branchId ?? null,
    });
    return res.json(ok(data));
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
    const startedAt = Date.now();
    const orderId = pathParam(req, "id");
    const body = req.body as { captainId: string };
    const requestId = createRequestId("reassign");
    logOrderActionControllerTiming("reassign", "endpoint_entry", {
      requestId,
      orderId,
      captainId: body.captainId,
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      note: "auth+rbac+validation already passed",
    });
    try {
      const data = await distributionService.reassign(orderId, body.captainId, req.user!.id, { requestId }, {
        userId: req.user!.id,
        role: req.user!.role as AppRole,
        companyId: req.user!.companyId ?? null,
        branchId: req.user!.branchId ?? null,
      });
      logOrderActionControllerTiming("reassign", "response_ready", {
        requestId,
        orderId,
        captainId: body.captainId,
        msFromEntry: Date.now() - startedAt,
      });
      return res.json(ok(data));
    } catch (error) {
      logOrderActionControllerTiming("reassign", "endpoint_error", {
        requestId,
        orderId,
        captainId: body.captainId,
        msFromEntry: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  startAutoDistribution: async (req: Request, res: Response) => {
    const data = await distributionService.startAuto(pathParam(req, "id"), req.user!.id, {
      userId: req.user!.id,
      role: req.user!.role as AppRole,
      companyId: req.user!.companyId ?? null,
      branchId: req.user!.branchId ?? null,
    });
    return res.json(ok(data));
  },

  autoAssignVisible: async (req: Request, res: Response) => {
    const body = req.body as { orderIds: string[]; zoneId?: string };
    const data = await distributionService.autoAssignVisible(
      { orderIds: body.orderIds, zoneId: body.zoneId ?? null },
      req.user!.id,
      {
        userId: req.user!.id,
        role: req.user!.role as AppRole,
        companyId: req.user!.companyId ?? null,
        branchId: req.user!.branchId ?? null,
      },
      {
        requestId: `auto-visible-${Date.now().toString(36)}`,
      },
    );
    return res.json(ok(data));
  },

  resendDistribution: async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const orderId = pathParam(req, "id");
    const requestId = createRequestId("resend_distribution");
    logOrderActionControllerTiming("resend_distribution", "endpoint_entry", {
      requestId,
      orderId,
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      note: "auth+rbac+validation already passed",
    });
    try {
      const data = await distributionService.resendToDistribution(orderId, req.user!.id, { requestId }, {
        userId: req.user!.id,
        role: req.user!.role as AppRole,
        companyId: req.user!.companyId ?? null,
        branchId: req.user!.branchId ?? null,
      });
      logOrderActionControllerTiming("resend_distribution", "response_ready", {
        requestId,
        orderId,
        msFromEntry: Date.now() - startedAt,
      });
      return res.json(ok(data));
    } catch (error) {
      logOrderActionControllerTiming("resend_distribution", "endpoint_error", {
        requestId,
        orderId,
        msFromEntry: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  cancelCaptainAssignment: async (req: Request, res: Response) => {
    const data = await distributionService.cancelCaptainAssignment(pathParam(req, "id"), req.user!.id, {
      userId: req.user!.id,
      role: req.user!.role as AppRole,
      companyId: req.user!.companyId ?? null,
      branchId: req.user!.branchId ?? null,
    });
    return res.json(ok(data));
  },

  manualAssign: async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const orderId = pathParam(req, "id");
    const requestId = createRequestId("manual_assign");
    const body = req.body as { captainId: string; assignmentType?: AssignmentType };
    const mode =
      body.assignmentType === $Enums.AssignmentType.DRAG_DROP
        ? $Enums.AssignmentType.DRAG_DROP
        : $Enums.AssignmentType.MANUAL;
    logOrderActionControllerTiming("manual_assign", "endpoint_entry", {
      requestId,
      orderId,
      captainId: body.captainId,
      assignmentType: mode,
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      note: "auth+rbac+validation already passed",
    });
    try {
      const data = await distributionService.assignManual(orderId, body.captainId, req.user!.id, mode, { requestId }, {
        userId: req.user!.id,
        role: req.user!.role as AppRole,
        companyId: req.user!.companyId ?? null,
        branchId: req.user!.branchId ?? null,
      });
      logOrderActionControllerTiming("manual_assign", "response_ready", {
        requestId,
        orderId,
        captainId: body.captainId,
        assignmentType: mode,
        msFromEntry: Date.now() - startedAt,
      });
      return res.json(ok(data));
    } catch (error) {
      logOrderActionControllerTiming("manual_assign", "endpoint_error", {
        requestId,
        orderId,
        captainId: body.captainId,
        assignmentType: mode,
        msFromEntry: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /** تعيين من لوحة السحب والإفلات — يسجل DRAG_DROP في OrderAssignmentLog */
  dragDropAssign: async (req: Request, res: Response) => {
    const requestId = createRequestId("manual_assign");
    const body = req.body as { captainId: string };
    const data = await distributionService.assignManual(
      pathParam(req, "id"),
      body.captainId,
      req.user!.id,
      $Enums.AssignmentType.DRAG_DROP,
      { requestId },
      {
        userId: req.user!.id,
        role: req.user!.role as AppRole,
        companyId: req.user!.companyId ?? null,
        branchId: req.user!.branchId ?? null,
      },
    );
    return res.json(ok(data));
  },
};
