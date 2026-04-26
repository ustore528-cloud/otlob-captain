import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import { notificationService } from "../services/notifications.service.js";

export const notificationsController = {
  create: async (req: Request, res: Response) => {
    const payload = req.body as { userId: string; type: string; title: string; message: string };
    const data = await notificationService.create(
      payload.userId,
      payload.type,
      payload.title,
      payload.message,
      req.user!.id,
    );
    return res.status(201).json(ok(data));
  },

  listMine: async (req: Request, res: Response) => {
    const q = req.query as { page?: number; pageSize?: number; isRead?: string };
    const data = await notificationService.list(req.user!.id, {
      page: Number(q.page) || 1,
      pageSize: Number(q.pageSize) || 20,
      isRead: q.isRead === undefined ? undefined : q.isRead === "true",
    });
    return res.json(ok(data));
  },

  markRead: async (req: Request, res: Response) => {
    await notificationService.markRead(pathParam(req, "id"), req.user!.id);
    return res.json(ok({ ok: true }));
  },

  markAllRead: async (req: Request, res: Response) => {
    await notificationService.markAllRead(req.user!.id);
    return res.json(ok({ ok: true }));
  },

  quickStatusAlert: async (req: Request, res: Response) => {
    const payload = req.body as {
      status: "PRESSURE" | "LOW_ACTIVITY" | "RAISE_READINESS" | "ON_FIRE";
      global?: boolean;
      targetCompanyId?: string;
    };
    const data = await notificationService.sendQuickStatusAlert(
      payload.status,
      {
        userId: req.user!.id,
        role: req.user!.role,
        companyId: req.user!.companyId,
      },
      { global: payload.global, targetCompanyId: payload.targetCompanyId },
    );
    return res.status(201).json(ok(data));
  },
};
