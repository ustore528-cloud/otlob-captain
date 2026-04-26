import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { listActiveCompaniesForSuperAdmin } from "../services/companies.service.js";

export const companiesController = {
  list: async (_req: Request, res: Response) => {
    const data = await listActiveCompaniesForSuperAdmin();
    return res.json(ok(data));
  },
};
