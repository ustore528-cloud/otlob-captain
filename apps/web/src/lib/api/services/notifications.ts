import { apiFetch, paths } from "@/lib/api/http";
import type { NotificationItem, Paginated } from "@/types/api";

export type QuickStatusCode = "PRESSURE" | "LOW_ACTIVITY" | "RAISE_READINESS" | "ON_FIRE";

export type CreateCaptainNotificationPayload = {
  userId: string;
  type: string;
  title: string;
  message: string;
};

export function listNotifications(token: string, page = 1, pageSize = 10): Promise<Paginated<NotificationItem>> {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<Paginated<NotificationItem>>(`${paths.notifications.root}?${p.toString()}`, { token });
}

export function createNotification(token: string, payload: CreateCaptainNotificationPayload): Promise<NotificationItem> {
  return apiFetch<NotificationItem>(paths.notifications.root, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function sendQuickStatus(token: string, status: QuickStatusCode): Promise<{ status: string; label: string; sent: number }> {
  return apiFetch(paths.notifications.quickStatus, {
    method: "POST",
    token,
    body: JSON.stringify({ status }),
  });
}
