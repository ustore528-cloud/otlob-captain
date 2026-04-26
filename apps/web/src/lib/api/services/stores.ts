import { apiFetch, paths } from "@/lib/api/http";
import type { Paginated, StoreListItem } from "@/types/api";

/**
 * `GET /stores` returns Prisma `$transaction` as JSON: `[total, items]` (same as repository tuple).
 * Other list endpoints return `{ total, items }` — normalize here so the web stays consistent.
 */
function normalizeStoresListPayload(raw: unknown): Paginated<StoreListItem> {
  if (
    Array.isArray(raw) &&
    raw.length === 2 &&
    typeof raw[0] === "number" &&
    Array.isArray(raw[1])
  ) {
    return { total: raw[0], items: raw[1] as StoreListItem[] };
  }
  if (
    raw !== null &&
    typeof raw === "object" &&
    "total" in raw &&
    "items" in raw &&
    typeof (raw as { total: unknown }).total === "number" &&
    Array.isArray((raw as { items: unknown }).items)
  ) {
    return raw as Paginated<StoreListItem>;
  }
  return { total: 0, items: [] };
}

export async function listStores(token: string, page = 1, pageSize = 100): Promise<Paginated<StoreListItem>> {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const raw = await apiFetch<unknown>(`${paths.stores.root}?${p.toString()}`, { token });
  return normalizeStoresListPayload(raw);
}

export type UpdateStorePayload = {
  subscriptionType?: "PUBLIC" | "SUPERVISOR_LINKED";
  supervisorUserId?: string | null;
};

export async function updateStore(token: string, storeId: string, body: UpdateStorePayload): Promise<StoreListItem> {
  return apiFetch<StoreListItem>(paths.stores.byId(storeId), {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}
