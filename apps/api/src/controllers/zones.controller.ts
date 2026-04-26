import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { listZonesForStaff } from "../services/zones.service.js";

export const zonesController = {
  list: async (req: Request, res: Response) => {
    const companyId = typeof req.query.companyId === "string" ? req.query.companyId.trim() : undefined;
    const data = await listZonesForStaff(req.user!.id, { companyId: companyId || undefined });
    return res.json(ok(data));
  },
};
