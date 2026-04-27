import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { createCompanyForSuperAdmin, listActiveCompaniesForSuperAdmin } from "../services/companies.service.js";
import { archiveCompany, getCompanyDeletePreview } from "../services/company-archive.service.js";

type CompanyParams = { companyId: string };

export const companiesController = {
  list: async (_req: Request, res: Response) => {
    const data = await listActiveCompaniesForSuperAdmin();
    return res.json(ok(data));
  },

  create: async (req: Request, res: Response) => {
    const body = req.body as { name: string };
    const data = await createCompanyForSuperAdmin({ name: body.name });
    return res.status(201).json(ok(data));
  },

  deletePreview: async (req: Request, res: Response) => {
    const { companyId } = req.params as CompanyParams;
    const data = await getCompanyDeletePreview(companyId);
    return res.json(ok(data));
  },

  archive: async (req: Request, res: Response) => {
    const { companyId } = req.params as CompanyParams;
    const body = req.body as { confirmPhrase?: string };
    const data = await archiveCompany(companyId, { confirmPhrase: body?.confirmPhrase });
    return res.json(ok(data));
  },
};
