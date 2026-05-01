import type { PaginationDto } from "./pagination.dto";

export type NotificationsListQuery = {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
};

export type NotificationLocaleTriplet = {
  ar?: string | null;
  en?: string | null;
  he?: string | null;
};

/** Optional UI triplets from API `display_i18n` — preferred over canonical title/body when present. */
export type NotificationDisplayI18n = {
  title?: NotificationLocaleTriplet;
  body?: NotificationLocaleTriplet;
};

/** Shape follows dashboard API — extend when backend fields are fixed in app. */
export type NotificationItemDto = {
  id: string;
  /** Server notification kind — used to localize legacy Arabic payloads. */
  type?: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  displayI18n?: NotificationDisplayI18n;
  /** When present, opens order detail on tap */
  orderId?: string;
};

export type NotificationsListResponse = {
  items: NotificationItemDto[];
  pagination: PaginationDto;
};
