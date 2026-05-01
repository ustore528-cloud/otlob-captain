import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import { captainMobileService } from "../services/captain-mobile.service.js";
import { toOrderDetailDto } from "../dto/order.dto.js";
import { notificationService } from "../services/notifications.service.js";
import { pushNotificationService } from "../services/push-notification.service.js";
import { prisma } from "../lib/prisma.js";

export const mobileCaptainController = {
  login: async (req: Request, res: Response) => {
    const body = req.body as { phone?: string; email?: string; password: string };
    const data = await captainMobileService.login(body);
    return res.json(ok(data));
  },

  refresh: async (req: Request, res: Response) => {
    const body = req.body as { refreshToken: string };
    const tokens = await captainMobileService.refresh(body.refreshToken);
    return res.json(
      ok({
        ...tokens,
        tokenType: "Bearer" as const,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      }),
    );
  },

  me: async (req: Request, res: Response) => {
    const data = await captainMobileService.me(req.user!.id);
    return res.json(ok(data));
  },

  prepaidSummary: async (req: Request, res: Response) => {
    const data = await captainMobileService.prepaidSummary(req.user!.id);
    return res.json(ok(data));
  },

  /** GET /mobile/captain/me/assignment — singular live snapshot (NONE | one OFFER | one ACTIVE). */
  currentAssignment: async (req: Request, res: Response) => {
    const data = await captainMobileService.getCurrentAssignment(req.user!.id);
    return res.json(ok(data));
  },

  /** GET /mobile/captain/me/assignment/overflow — secondary assignable / in-flight orders not on the primary card. */
  assignmentOverflow: async (req: Request, res: Response) => {
    const data = await captainMobileService.getAssignmentOverflow(req.user!.id);
    return res.json(ok(data));
  },

  /** Latest global quick work-status alert (admin dashboard) — for captain app indicator. */
  workStatus: async (_req: Request, res: Response) => {
    const data = await notificationService.getLatestQuickWorkStatus();
    return res.json(ok(data));
  },

  getOrderById: async (req: Request, res: Response) => {
    const data = await captainMobileService.getOrderById(req.user!.id, pathParam(req, "orderId"));
    return res.json(ok(data));
  },

  updateAvailability: async (req: Request, res: Response) => {
    const body = req.body as { availabilityStatus: import("@prisma/client").CaptainAvailabilityStatus };
    const data = await captainMobileService.updateAvailability(req.user!.id, body.availabilityStatus);
    return res.json(ok(data));
  },

  registerPushToken: async (req: Request, res: Response) => {
    const body = req.body as {
      token: string;
      platform: "android" | "ios";
      appVersion?: string | null;
      language?: "ar" | "en" | "he" | null;
    };
    const captain = await prisma.captain.findFirst({
      where: { userId: req.user!.id },
      select: { id: true, companyId: true },
    });
    // eslint-disable-next-line no-console
    console.info("[mobileCaptainController.registerPushToken] request_received", {
      userId: req.user!.id,
      captainId: captain?.id ?? null,
      companyId: captain?.companyId ?? null,
      platform: body.platform,
      appVersion: body.appVersion ?? null,
      language: body.language ?? null,
      token: body.token ? `${body.token.slice(0, 18)}...${body.token.slice(-6)}` : null,
    });
    const data = await pushNotificationService.registerCaptainPushToken({
      userId: req.user!.id,
      token: body.token,
      platform: body.platform,
      appVersion: body.appVersion ?? null,
      locale: body.language ?? null,
    });
    // eslint-disable-next-line no-console
    console.info("[mobileCaptainController.registerPushToken] response_ready", {
      userId: req.user!.id,
      captainId: captain?.id ?? null,
      registered: data.registered,
    });
    return res.json(ok(data));
  },

  acceptOrder: async (req: Request, res: Response) => {
    const order = await captainMobileService.acceptOrder(pathParam(req, "orderId"), req.user!.id);
    return res.json(ok(toOrderDetailDto(order)));
  },

  rejectOrder: async (req: Request, res: Response) => {
    const order = await captainMobileService.rejectOrder(pathParam(req, "orderId"), req.user!.id);
    return res.json(ok(order ? toOrderDetailDto(order) : null));
  },

  updateOrderStatus: async (req: Request, res: Response) => {
    const body = req.body as { status: import("@prisma/client").OrderStatus };
    const order = await captainMobileService.updateOrderStatus(
      pathParam(req, "orderId"),
      body.status,
      req.user!.id,
    );
    return res.json(ok(toOrderDetailDto(order)));
  },

  updateLocation: async (req: Request, res: Response) => {
    const body = req.body as {
      latitude: number;
      longitude: number;
      heading?: number | null;
      speed?: number | null;
      accuracy?: number | null;
      timestamp?: string | null;
    };
    const loc = await captainMobileService.updateLocation(req.user!.id, body.latitude, body.longitude, {
      heading: body.heading ?? null,
      speed: body.speed ?? null,
      accuracy: body.accuracy ?? null,
      timestamp: body.timestamp ?? null,
    });
    return res.json(
      ok({
        id: loc.id,
        captainId: loc.captainId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        recordedAt: loc.recordedAt.toISOString(),
      }),
    );
  },

  orderHistory: async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      page: number;
      pageSize: number;
      status?: import("@prisma/client").OrderStatus;
      from?: Date;
      to?: Date;
    };
    const data = await captainMobileService.orderHistory(req.user!.id, q);
    return res.json(ok(data));
  },

  earningsSummary: async (req: Request, res: Response) => {
    const q = req.query as unknown as { from?: Date; to?: Date };
    const data = await captainMobileService.earningsSummary(req.user!.id, q);
    return res.json(ok(data));
  },

  /** POST /mobile/captain/me/delete-account — soft-deactivate authenticated captain only. */
  deleteAccount: async (req: Request, res: Response) => {
    const body = req.body as { reason?: string | null };
    const data = await captainMobileService.deleteCaptainAccount(req.user!.id, body.reason ?? null);
    return res.json(ok(data));
  },
};
