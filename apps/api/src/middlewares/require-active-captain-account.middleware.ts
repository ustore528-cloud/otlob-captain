import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";

/** Blocks captain mobile APIs after the user has been soft-deactivated (self-delete or admin). */
export async function requireActiveCaptainAccount(req: Request, _res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { isActive: true } });
  if (!user?.isActive) {
    return next(new AppError(403, "Account is no longer active", "FORBIDDEN"));
  }
  next();
}
