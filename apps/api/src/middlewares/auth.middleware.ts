import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { AppError } from "../utils/errors.js";

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Missing bearer token", "UNAUTHORIZED"));
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      storeId: payload.storeId,
    };
    return next();
  } catch {
    return next(new AppError(401, "Invalid or expired token", "UNAUTHORIZED"));
  }
}
