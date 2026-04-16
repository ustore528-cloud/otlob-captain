import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import { storesService } from "../services/stores.service.js";

export const storesController = {
  create: async (req: Request, res: Response) => {
    const data = await storesService.create(req.body as Parameters<typeof storesService.create>[0], req.user!.id);
    return res.status(201).json(ok(data));
  },

  update: async (req: Request, res: Response) => {
    const data = await storesService.update(
      pathParam(req, "id"),
      req.body as Parameters<typeof storesService.update>[1],
      req.user!.id,
      { role: req.user!.role, userId: req.user!.id, storeId: req.user!.storeId },
    );
    return res.json(ok(data));
  },

  list: async (req: Request, res: Response) => {
    const q = req.query as { page?: number; pageSize?: number; area?: string; isActive?: boolean };
    const data = await storesService.list(
      {
        area: q.area,
        isActive: q.isActive,
        page: Number(q.page) || 1,
        pageSize: Number(q.pageSize) || 20,
      },
      { role: req.user!.role, userId: req.user!.id },
    );
    return res.json(ok(data));
  },

  getById: async (req: Request, res: Response) => {
    const data = await storesService.getById(pathParam(req, "id"), {
      role: req.user!.role,
      userId: req.user!.id,
    });
    return res.json(ok(data));
  },
};
