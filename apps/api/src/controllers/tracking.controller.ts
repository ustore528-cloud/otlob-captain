import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { trackingService } from "../services/tracking.service.js";

export const trackingController = {
  updateMyLocation: async (req: Request, res: Response) => {
    const body = req.body as { latitude: number; longitude: number };
    const data = await trackingService.updateLocation(req.user!.id, body.latitude, body.longitude);
    return res.json(ok(data));
  },

  latestLocations: async (req: Request, res: Response) => {
    const raw = (req.query as { captainIds?: string }).captainIds;
    const ids = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const data = await trackingService.latestLocations(ids);
    return res.json(ok(data));
  },

  activeMap: async (_req: Request, res: Response) => {
    const data = await trackingService.activeCaptainsMap();
    return res.json(ok(data));
  },
};
