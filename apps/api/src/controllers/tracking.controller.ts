import type { Request, Response } from "express";
import type { AppRole } from "../lib/rbac-roles.js";
import { ok } from "../utils/api-response.js";
import { trackingService } from "../services/tracking.service.js";

export const trackingController = {
  updateMyLocation: async (req: Request, res: Response) => {
    const body = req.body as {
      latitude: number;
      longitude: number;
      heading?: number | null;
      speed?: number | null;
      accuracy?: number | null;
      timestamp?: string | null;
    };
    const data = await trackingService.updateLocation(req.user!.id, body.latitude, body.longitude, {
      heading: body.heading ?? null,
      speed: body.speed ?? null,
      accuracy: body.accuracy ?? null,
      timestamp: body.timestamp ?? null,
    });
    return res.json(ok(data));
  },

  latestLocations: async (req: Request, res: Response) => {
    const raw = (req.query as { captainIds?: string }).captainIds;
    const ids = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const data = await trackingService.latestLocations(ids, {
      userId: req.user!.id,
      role: req.user!.role as AppRole,
      companyId: req.user!.companyId ?? null,
      branchId: req.user!.branchId ?? null,
    });
    return res.json(ok(data));
  },

  activeMap: async (req: Request, res: Response) => {
    const data = await trackingService.activeCaptainsMap({
      userId: req.user!.id,
      role: req.user!.role as AppRole,
      companyId: req.user!.companyId ?? null,
      branchId: req.user!.branchId ?? null,
    });
    return res.json(ok(data));
  },
};
