import { apiFetch, paths } from "@/lib/api/http";
import type { Paginated, StoreListItem } from "@/types/api";

export function listStores(token: string, page = 1, pageSize = 100): Promise<Paginated<StoreListItem>> {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<Paginated<StoreListItem>>(`${paths.stores.root}?${p.toString()}`, { token });
}
