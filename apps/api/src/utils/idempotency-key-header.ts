import type { Request } from "express";
import { AppError } from "./errors.js";

/**
 * Reads `Idempotency-Key` (case-insensitive per Node/Express) and returns a trimmed non-empty string.
 */
export function requireIdempotencyKeyHeader(req: Request): string {
  const raw = req.headers["idempotency-key"];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new AppError(400, "Idempotency-Key header is required", "IDEMPOTENCY_KEY_REQUIRED");
  }
  return raw.trim();
}
