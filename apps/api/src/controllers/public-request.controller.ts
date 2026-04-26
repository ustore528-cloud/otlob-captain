import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import { createOrderFromPublicPage, getRequestContextByOwnerCode } from "../services/public-request.service.js";

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
};
