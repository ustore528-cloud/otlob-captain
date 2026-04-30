import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import { listComplaints, patchComplaintStatus } from "../services/complaints.service.js";
import type { AppRole } from "../lib/rbac-roles.js";

export const complaintsController = {
  list: async (req: Request, res: Response) => {
    const user = req.user!;
    const data = await listComplaints({
      role: user.role as AppRole,
      companyId: user.companyId ?? null,
    });
    return res.json(ok(data));
  },

  patchStatus: async (req: Request, res: Response) => {
    const user = req.user!;
    const id = pathParam(req, "id");
    const { status } = req.body as { status: Parameters<typeof patchComplaintStatus>[1] };
    const result = await patchComplaintStatus(id, status, {
      role: user.role as AppRole,
      companyId: user.companyId ?? null,
    });
    return res.json(ok(result));
  },
};
