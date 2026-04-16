import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { activityReadService } from "../services/activity-read.service.js";

export const activityController = {
  list: async (req: Request, res: Response) => {
    const q = req.query as Record<string, string | undefined>;
    const data = await activityReadService.list({
      userId: q.userId,
      entityType: q.entityType,
      entityId: q.entityId,
      page: Number(q.page) || 1,
      pageSize: Number(q.pageSize) || 20,
    });
    return res.json(ok(data));
  },
};
