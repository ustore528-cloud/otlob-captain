import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import {
  createOrderFromPublicPage,
  getPublicOrderIdsByTrackingToken,
  getPublicOrderTracking,
  getRequestContextByOwnerCode,
  listNearbyCaptainsPublic,
} from "../services/public-request.service.js";
import { submitPublicComplaintByOwnerCode } from "../services/complaints.service.js";
import { reverseGeocodeFromLatLng } from "../services/geocode-nominatim.service.js";
import { AppError } from "../utils/errors.js";
import {
  getPublicCustomerWebPushVapidPublicKey,
  isPublicCustomerWebPushConfigured,
  upsertCustomerWebPushSubscriptionByTrackingToken,
  upsertPublicCustomerOrderPushSubscription,
} from "../services/customer-public-order-web-push.service.js";

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

  orderIdsByTrackingToken: async (req: Request, res: Response) => {
    const { trackingToken } = req.params as { trackingToken: string };
    const data = await getPublicOrderIdsByTrackingToken(trackingToken);
    return res.json(ok(data));
  },

  /** Browser Web Push (public customer site) — VAPID public key for PushManager.subscribe */
  pushWebVapidPublicKey: async (_req: Request, res: Response) => {
    if (!isPublicCustomerWebPushConfigured()) {
      throw new AppError(503, "خدمة الإشعارات غير مهيّأة على الخادم.", "WEB_PUSH_UNAVAILABLE", {
        messageAr: "الإشعارات غير مفعّلة حالياً.",
        messageEn: "Notifications are not enabled on this server.",
        messageHe: "ההתראות אינן מוגדרות בשרת זה.",
      });
    }
    const publicKey = getPublicCustomerWebPushVapidPublicKey();
    if (!publicKey) {
      throw new AppError(503, "خدمة الإشعارات غير مهيّأة على الخادم.", "WEB_PUSH_UNAVAILABLE");
    }
    return res.json(ok({ publicKey }));
  },

  subscribePublicWebPush: async (req: Request, res: Response) => {
    const body = req.body as {
      ownerCode: string;
      orderId: string;
      trackingToken: string;
      locale?: string;
      userAgent?: string;
      platform?: string;
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    };
    const fallbackUa = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;
    await upsertPublicCustomerOrderPushSubscription({
      ownerCode: body.ownerCode,
      orderId: body.orderId,
      trackingToken: body.trackingToken,
      locale: body.locale,
      userAgent: body.userAgent ?? fallbackUa ?? null,
      platform: body.platform ?? null,
      subscription: body.subscription,
    });
    return res.status(204).send();
  },

  /** Preferred: POST body + `:trackingToken` only (no ownerCode / orderId in body). */
  subscribePublicWebPushByTrackingToken: async (req: Request, res: Response) => {
    const trackingToken = pathParam(req, "trackingToken");
    const body = req.body as {
      locale?: string;
      userAgent?: string;
      platform?: string;
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    };
    const fallbackUa = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;
    await upsertCustomerWebPushSubscriptionByTrackingToken({
      trackingToken,
      locale: body.locale ?? null,
      userAgent: body.userAgent ?? fallbackUa ?? null,
      platform: body.platform ?? null,
      subscription: body.subscription,
    });
    return res.status(200).json(ok({ subscribed: true }));
  },
};
