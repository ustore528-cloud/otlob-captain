import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { ordersService } from "../services/orders.service.js";

export const customerOrdersController = {
  listMine: async (req: Request, res: Response) => {
    const q = req.query as { page?: number; pageSize?: number };
    const data = await ordersService.listForCustomer(req.user!.id, {
      page: Number(q.page) || 1,
      pageSize: Number(q.pageSize) || 20,
    });
    return res.json(ok(data));
  },
};
