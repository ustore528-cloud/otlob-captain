import type { NextFunction, Request, Response } from "express";

/**
 * نقطة تعليق جاهزة لوضع rate limiting (Redis / in-memory).
 * حاليًا لا تطبق أي حدود — لكنها توحّد واجهة الإضافة لاحقًا.
 */
export function rateLimitContextMiddleware(_req: Request, _res: Response, next: NextFunction) {
  // مثال مستقبلي:
  // const key = `${req.ip}:${req.user?.id ?? "anon"}`;
  // await rateLimiter.consume(key);
  return next();
}

