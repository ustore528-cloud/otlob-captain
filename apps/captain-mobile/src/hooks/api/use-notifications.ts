import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { NotificationsListQuery, NotificationsListResponse } from "@/services/api/dto";
import { notificationsService } from "@/services/api/services/notifications.service";
import { queryKeys } from "./query-keys";

function hashQuery(q?: NotificationsListQuery): string {
  return JSON.stringify(q ?? {});
}

export function useNotificationsList(
  query?: NotificationsListQuery,
  options?: Omit<UseQueryOptions<NotificationsListResponse, Error>, "queryKey" | "queryFn">,
) {
  const qh = hashQuery(query);
  return useQuery({
    queryKey: queryKeys.notifications.list(qh),
    queryFn: () => notificationsService.list(query),
    ...options,
  });
}
