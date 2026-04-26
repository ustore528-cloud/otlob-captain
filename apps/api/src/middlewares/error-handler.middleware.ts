import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import createError from "http-errors";
import { AppError } from "../utils/errors.js";
import { fail } from "../utils/api-response.js";

type HttpErrorLike = { status: number; statusCode: number; message: string; type?: string };

function httpErrorToApiCode(h: HttpErrorLike): string {
  if (h.type === "entity.parse.failed") return "INVALID_JSON";
  if (h.type === "charset.unsupported" || h.type === "encoding.unsupported") return "UNSUPPORTED_ENCODING";
  if (h.status >= 500) return "INTERNAL";
  return "BAD_REQUEST";
}

export function errorHandlerMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(fail(err.code, err.message, err.details));
  }
  if (err instanceof ZodError) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Validation failed", err.flatten()));
  }
  if (createError.isHttpError(err)) {
    const h = err as HttpErrorLike;
    return res.status(h.status).json(fail(httpErrorToApiCode(h), h.message));
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json(fail("CONFLICT", "Unique constraint violation"));
    }
    if (err.code === "P2025") {
      return res.status(404).json(fail("NOT_FOUND", "Record not found"));
    }
    if (err.code === "P2028") {
      return res.status(503).json(
        fail("TRANSACTION_TIMEOUT", "Database transaction timed out. Retry the action or check server load."),
      );
    }
  }
  console.error(err);
  return res.status(500).json(fail("INTERNAL", "Internal server error"));
}
