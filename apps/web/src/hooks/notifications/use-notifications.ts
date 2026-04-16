import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { useAuthStore } from "@/stores/auth-store";

export function useNotifications(page = 1, pageSize = 10, options?: { enabled?: boolean }) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: queryKeys.notifications.list(page, pageSize),
    queryFn: () => api.notifications.list(page, pageSize),
    enabled: (options?.enabled ?? true) && Boolean(token),
  });
}
