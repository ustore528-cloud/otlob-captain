import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { useAuthStore } from "@/stores/auth-store";

export function useActivityList(page = 1, pageSize = 15, options?: { enabled?: boolean }) {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  const can = role === "ADMIN" || role === "DISPATCHER";
  return useQuery({
    queryKey: queryKeys.activity.list(page, pageSize),
    queryFn: () => api.activity.list(page, pageSize),
    enabled: (options?.enabled ?? true) && Boolean(token) && can,
  });
}
