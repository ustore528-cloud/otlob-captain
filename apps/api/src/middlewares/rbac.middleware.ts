import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors.js";
import type { AppRole } from "../lib/rbac-roles.js";

export function requireRoles(...allowed: AppRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "Unauthorized", "UNAUTHORIZED"));
    if (!allowed.includes(req.user.role)) {
      return next(
        new AppError(403, "This account role is not allowed for this operation.", "ROLE_NOT_SUPPORTED"),
      );
    }
    return next();
  };
}
