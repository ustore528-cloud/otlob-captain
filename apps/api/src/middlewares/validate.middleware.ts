import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

type Part = "body" | "query" | "params";

export function validate(part: Part, schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const source = part === "body" ? req.body : part === "query" ? req.query : req.params;
    const parsed = schema.safeParse(source);
    if (!parsed.success) return next(parsed.error);
    if (part === "body") req.body = parsed.data as typeof req.body;
    if (part === "query") Object.assign(req.query as object, parsed.data as object);
    if (part === "params") Object.assign(req.params as object, parsed.data as object);
    next();
  };
}
