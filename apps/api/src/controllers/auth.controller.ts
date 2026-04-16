import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { authService } from "../services/auth.service.js";

export const authController = {
  login: async (req: Request, res: Response) => {
    const body = req.body as { phone?: string; email?: string; password: string };
    const data = await authService.login(body);
    return res.json(ok(data));
  },

  refresh: async (req: Request, res: Response) => {
    const body = req.body as { refreshToken: string };
    const data = await authService.refresh(body.refreshToken);
    return res.json(ok(data));
  },

  me: async (req: Request, res: Response) => {
    const data = await authService.me(req.user!.id);
    return res.json(ok(data));
  },

  register: async (req: Request, res: Response) => {
    const data = await authService.register(req.body as Parameters<typeof authService.register>[0]);
    return res.status(201).json(ok(data));
  },
};
