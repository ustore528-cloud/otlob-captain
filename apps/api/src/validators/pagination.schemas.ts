import { z } from "zod";

/** Express may set the same key to `string[]` if repeated — normalize before coercion. */
function firstQueryValue(v: unknown): unknown {
  if (v === undefined || v === null) return v;
  return Array.isArray(v) ? v[0] : v;
}

export const PaginationQuerySchema = z.object({
  page: z.preprocess(
    firstQueryValue,
    z.coerce.number().int().min(1).max(1_000_000).default(1),
  ),
  pageSize: z.preprocess(
    firstQueryValue,
    z.coerce.number().int().min(1).max(100).default(20),
  ),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
