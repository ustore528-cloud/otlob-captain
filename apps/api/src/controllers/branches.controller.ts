import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { listForStaff } from "../services/branches.service.js";

export const branchesController = {
  list: async (req: Request, res: Response) => {
    const companyId = typeof req.query.companyId === "string" ? req.query.companyId.trim() : undefined;
    const data = await listForStaff(req.user!.id, { companyId: companyId || undefined });
    return res.json(ok(data));
  },
};
