import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { geocodePlaceFromParts } from "../services/geocode-nominatim.service.js";

export const geocodeController = {
  place: async (req: Request, res: Response) => {
    const q = req.query as { country?: string; city?: string };
    const data = await geocodePlaceFromParts(q.country, q.city);
    return res.json(ok(data));
  },
};
