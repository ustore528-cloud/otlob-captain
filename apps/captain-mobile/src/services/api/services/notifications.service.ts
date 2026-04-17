import { paths } from "@captain/shared";
import { authRequest, buildQueryString } from "../client";
import type { NotificationsListQuery, NotificationsListResponse, NotificationItemDto } from "../dto";

/** Backend returns `[total, rows]` from Prisma transaction — normalize for the app. */
type RawNotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  orderId?: string;
};

type RawListPayload = [number, RawNotificationRow[]];

function toIso(createdAt: string | Date): string {
  if (typeof createdAt === "string") return createdAt;
  return new Date(createdAt).toISOString();
}

export const notificationsService = {
  async list(query?: NotificationsListQuery): Promise<NotificationsListResponse> {
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const qs = buildQueryString({
      page,
      pageSize,
      isRead: query?.isRead,
    });
    const data = await authRequest<RawListPayload>(`${paths.notifications.root}${qs}`, { method: "GET" });
    const [total, rows] = data;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const items: NotificationItemDto[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      isRead: r.isRead,
      createdAt: toIso(r.createdAt),
      ...(r.orderId != null && r.orderId !== "" ? { orderId: r.orderId } : {}),
    }));
    return {
      items,
      pagination: { page, pageSize, total, totalPages },
    };
  },

  markRead(notificationId: string): Promise<unknown> {
    return authRequest(paths.notifications.read(notificationId), { method: "PATCH" });
  },

  readAll(): Promise<unknown> {
    return authRequest(paths.notifications.readAll, { method: "POST" });
  },
};
