import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import type { AppRole } from "../lib/rbac-roles.js";

/**
 * ضبط req.user إن وُجد Bearer صالح؛ يُكمِّل بدون مستخدم للمسارات العمومية.
 */
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  if (!header.startsWith("Bearer ")) return next();

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.user = {
      id: payload.sub,
      role: payload.role as AppRole,
      storeId: payload.storeId,
      companyId: payload.companyId,
      branchId: payload.branchId,
    };
  } catch {
    // تجاهل رمزًا غير صالح؛ المسار نفسه قد يتطلب عمومًا سياق عامًا
  }

  return next();
}
