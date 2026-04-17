import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import { captainMobileService } from "../services/captain-mobile.service.js";
import { toOrderDetailDto } from "../dto/order.dto.js";

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

  currentAssignment: async (req: Request, res: Response) => {
    const data = await captainMobileService.getCurrentAssignment(req.user!.id);
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
    const body = req.body as { latitude: number; longitude: number };
    const loc = await captainMobileService.updateLocation(req.user!.id, body.latitude, body.longitude);
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
};
