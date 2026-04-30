import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import {
  createOrderFromPublicPage,
  getPublicOrderTracking,
  getRequestContextByOwnerCode,
  listNearbyCaptainsPublic,
} from "../services/public-request.service.js";
import { submitPublicComplaintByOwnerCode } from "../services/complaints.service.js";
import { reverseGeocodeFromLatLng } from "../services/geocode-nominatim.service.js";

export const publicRequestController = {
  requestContext: async (req: Request, res: Response) => {
    const code = pathParam(req, "code");
    const data = await getRequestContextByOwnerCode(code);
    return res.json(ok(data));
  },

  createOrder: async (req: Request, res: Response) => {
    const data = await createOrderFromPublicPage(req.body as Parameters<typeof createOrderFromPublicPage>[0]);
    return res.status(201).json(ok(data));
  },

  submitComplaint: async (req: Request, res: Response) => {
    const ownerCode = pathParam(req, "ownerCode");
    const body = req.body as {
      customerName: string;
      customerPhone: string;
      complaintType: string;
      message: string;
    };
    const data = await submitPublicComplaintByOwnerCode(ownerCode, body);
    return res.status(201).json(ok(data));
  },

  /** GET ?lat=&lng= — بدون مصادقة؛ للصفحة العامة فقط */
  reverseGeocode: async (req: Request, res: Response) => {
    const q = req.query as { lat: string; lng: string };
    const lat = Number(q.lat);
    const lng = Number(q.lng);
    const data = await reverseGeocodeFromLatLng(lat, lng);
    return res.json(ok(data));
  },

  nearbyCaptains: async (req: Request, res: Response) => {
    const p = req.params as { code: string };
    const q = req.query as unknown as { lat: number; lng: number; radiusKm?: number };
    const data = await listNearbyCaptainsPublic(p.code, q.lat, q.lng, q.radiusKm);
    return res.json(ok(data));
  },

  orderTracking: async (req: Request, res: Response) => {
    const { ownerCode, orderId } = req.params as { ownerCode: string; orderId: string };
    const { token } = req.query as unknown as { token: string };
    const data = await getPublicOrderTracking(ownerCode, orderId, token);
    return res.json(ok(data));
  },
};
