import { apiFetch, paths } from "@/lib/api/http";
import type { ActivityItem, Paginated } from "@/types/api";

export function listActivity(token: string, page = 1, pageSize = 15): Promise<Paginated<ActivityItem>> {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<Paginated<ActivityItem>>(`${paths.activity.root}?${p.toString()}`, { token });
}
