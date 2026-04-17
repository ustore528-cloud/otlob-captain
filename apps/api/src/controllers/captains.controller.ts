import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import { captainsService } from "../services/captains.service.js";

export const captainsController = {
  create: async (req: Request, res: Response) => {
    const data = await captainsService.create(req.body as Parameters<typeof captainsService.create>[0], req.user!.id);
    return res.status(201).json(ok(data));
  },

  update: async (req: Request, res: Response) => {
    const data = await captainsService.update(
      pathParam(req, "id"),
      req.body as Parameters<typeof captainsService.update>[1],
      req.user!.id,
      { role: req.user!.role, userId: req.user!.id },
    );
    return res.json(ok(data));
  },

  list: async (req: Request, res: Response) => {
    const q = req.query as {
      page?: number;
      pageSize?: number;
      area?: string;
      isActive?: boolean | string;
      availabilityStatus?: string;
    };
    const isActive =
      q.isActive === undefined
        ? undefined
        : typeof q.isActive === "string"
          ? q.isActive === "true"
          : q.isActive;
    const data = await captainsService.list({
      page: Number(q.page) || 1,
      pageSize: Number(q.pageSize) || 20,
      area: q.area,
      isActive,
      availabilityStatus: q.availabilityStatus as never,
    });
    return res.json(ok(data));
  },

  getById: async (req: Request, res: Response) => {
    const data = await captainsService.getById(pathParam(req, "id"));
    return res.json(ok(data));
  },

  setActive: async (req: Request, res: Response) => {
    const body = req.body as { isActive: boolean };
    const data = await captainsService.setActive(pathParam(req, "id"), body.isActive, req.user!.id);
    return res.json(ok(data));
  },

  setAvailability: async (req: Request, res: Response) => {
    const body = req.body as { availabilityStatus: import("@prisma/client").CaptainAvailabilityStatus };
    const id = pathParam(req, "id");
    const data = await captainsService.setAvailability(id, req.user!.id, body.availabilityStatus, req.user!.id, {
      role: req.user!.role,
    });
    return res.json(ok(data));
  },

  stats: async (req: Request, res: Response) => {
    const data = await captainsService.stats(pathParam(req, "id"));
    return res.json(ok(data));
  },

  listOrders: async (req: Request, res: Response) => {
    const q = req.query as Record<string, string | undefined>;
    const data = await captainsService.listOrders(pathParam(req, "id"), {
      page: Number(q.page) || 1,
      pageSize: Number(q.pageSize) || 20,
      from: q.from,
      to: q.to,
      q: q.q,
      area: q.area,
      status: q.status as never,
    });
    return res.json(ok(data));
  },

  deleteCaptain: async (req: Request, res: Response) => {
    const data = await captainsService.deleteCaptain(pathParam(req, "id"), req.user!.id);
    return res.json(ok(data));
  },
};
