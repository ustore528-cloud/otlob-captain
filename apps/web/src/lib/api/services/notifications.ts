import { apiFetch, paths } from "@/lib/api/http";
import type { NotificationItem, Paginated } from "@/types/api";

export function listNotifications(token: string, page = 1, pageSize = 10): Promise<Paginated<NotificationItem>> {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<Paginated<NotificationItem>>(`${paths.notifications.root}?${p.toString()}`, { token });
}
