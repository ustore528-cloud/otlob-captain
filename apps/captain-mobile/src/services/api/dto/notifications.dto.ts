import type { PaginationDto } from "./pagination.dto";

export type NotificationsListQuery = {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
};

/** Shape follows dashboard API — extend when backend fields are fixed in app. */
export type NotificationItemDto = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  /** إن وُجد من الخادم — للانتقال إلى تفاصيل الطلب */
  orderId?: string;
};

export type NotificationsListResponse = {
  items: NotificationItemDto[];
  pagination: PaginationDto;
};
