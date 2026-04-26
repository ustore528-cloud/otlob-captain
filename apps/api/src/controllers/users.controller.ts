import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import { usersService } from "../services/users.service.js";

export const usersController = {
  list: async (req: Request, res: Response) => {
    const q = req.query as { role?: string; page?: number; pageSize?: number };
    const data = await usersService.list({
      role: q.role as never,
      page: Number(q.page) || 1,
      pageSize: Number(q.pageSize) || 20,
    }, {
      userId: req.user!.id,
      role: req.user!.role,
      companyId: req.user!.companyId ?? null,
      branchId: req.user!.branchId ?? null,
    });
    return res.json(ok(data));
  },

  getById: async (req: Request, res: Response) => {
    const data = await usersService.getById(pathParam(req, "id"), {
      userId: req.user!.id,
      role: req.user!.role,
      companyId: req.user!.companyId ?? null,
      branchId: req.user!.branchId ?? null,
    });
    return res.json(ok(data));
  },

  setActive: async (req: Request, res: Response) => {
    const body = req.body as { isActive: boolean };
    const data = await usersService.setActive(pathParam(req, "id"), body.isActive, req.user!.id, {
      userId: req.user!.id,
      role: req.user!.role,
      companyId: req.user!.companyId ?? null,
      branchId: req.user!.branchId ?? null,
    });
    return res.json(ok(data));
  },

  create: async (req: Request, res: Response) => {
    const data = await usersService.create(
      req.body as Parameters<typeof usersService.create>[0],
      req.user!.id,
      {
        userId: req.user!.id,
        role: req.user!.role,
        companyId: req.user!.companyId ?? null,
        branchId: req.user!.branchId ?? null,
      },
    );
    return res.status(201).json(ok(data));
  },

  updateCustomerProfile: async (req: Request, res: Response) => {
    const data = await usersService.updateCustomerProfile(pathParam(req, "id"), req.body as never, {
      userId: req.user!.id,
      role: req.user!.role,
      companyId: req.user!.companyId ?? null,
      branchId: req.user!.branchId ?? null,
    });
    return res.json(ok(data));
  },
};
