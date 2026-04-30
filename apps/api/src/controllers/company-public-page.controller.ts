import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { AppError } from "../utils/errors.js";
import { PublicPageSettingsPatchSchema } from "../services/public-page-settings.js";
import {
  readPublicPageSettingsResolved,
  updatePublicPageSettingsForCompany,
} from "../services/company-public-page.service.js";

export const companyPublicPageController = {
  get: async (req: Request, res: Response) => {
    const cid = req.user?.companyId;
    if (!cid) throw new AppError(403, "Company scope required", "FORBIDDEN");
    const data = await readPublicPageSettingsResolved(cid);
    return res.json(ok(data));
  },

  patch: async (req: Request, res: Response) => {
    const cid = req.user?.companyId;
    if (!cid) throw new AppError(403, "Company scope required", "FORBIDDEN");
    const body = PublicPageSettingsPatchSchema.safeParse(req.body);
    if (!body.success) {
      throw new AppError(400, "Invalid patch body", "VALIDATION_FAILED", body.error.flatten());
    }
    const data = await updatePublicPageSettingsForCompany({
      companyId: cid,
      patch: body.data,
    });
    return res.json(ok(data));
  },
};
