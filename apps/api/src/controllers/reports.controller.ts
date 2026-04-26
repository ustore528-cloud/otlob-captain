import type { Request, Response } from "express";
import { reportsService } from "../services/reports.service.js";
import { ok } from "../utils/api-response.js";
import type { AppRole } from "../lib/rbac-roles.js";

function actorFromReq(req: Request) {
  const u = req.user!;
  return {
    userId: u.id,
    role: u.role as AppRole,
    companyId: u.companyId ?? null,
    branchId: u.branchId ?? null,
  };
}

export const reportsController = {
  reconciliationSummary: async (req: Request, res: Response) => {
    const q = req.query as unknown as { from: string; to: string };
    const data = await reportsService.getReconciliationSummary(actorFromReq(req), { from: q.from, to: q.to });
    return res.json(ok(data));
  },

  deliveredCommissions: async (req: Request, res: Response) => {
    const q = req.query as unknown as { from: string; to: string; page: number; pageSize: number };
    const data = await reportsService.listDeliveredCommissions(actorFromReq(req), {
      from: q.from,
      to: q.to,
      page: q.page,
      pageSize: q.pageSize,
    });
    return res.json(ok(data));
  },

  ordersHistory: async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      from: string;
      to: string;
      page: number;
      pageSize: number;
      captainId?: string;
      storeId?: string;
      status?: import("@prisma/client").OrderStatus;
    };
    const data = await reportsService.listOrdersHistory(actorFromReq(req), {
      from: q.from,
      to: q.to,
      page: q.page,
      pageSize: q.pageSize,
      captainId: q.captainId,
      storeId: q.storeId,
      status: q.status,
    });
    return res.json(ok(data));
  },
};
