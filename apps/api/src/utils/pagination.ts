/** Defaults align with `PaginationQuerySchema` in `validators/pagination.schemas.ts`. */
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE = 1_000_000;
const MAX_PAGE_SIZE = 100;

/**
 * Coerce pagination inputs to integers before Prisma `skip` / `take`.
 * Express query values are strings; callers may also pass `string[]` for duplicate keys — never pass those through to Prisma.
 */
function toBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const t = Math.trunc(value);
    if (t < min || t > max) return fallback;
    return t;
  }
  if (typeof value === "bigint") {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const t = Math.trunc(n);
    if (t < min || t > max) return fallback;
    return t;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isFinite(parsed)) return fallback;
    if (parsed < min || parsed > max) return fallback;
    return parsed;
  }
  return fallback;
}

export function normalizePaginationForPrisma(input: { page: unknown; pageSize: unknown }): {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
} {
  const page = toBoundedInt(input.page, DEFAULT_PAGE, 1, MAX_PAGE);
  const pageSize = toBoundedInt(input.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}
