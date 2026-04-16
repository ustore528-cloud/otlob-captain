import { useQuery } from "@tanstack/react-query";
import { queryKeys, type CaptainsListParams } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { useAuthStore } from "@/stores/auth-store";

export const DEFAULT_CAPTAINS_LIST: CaptainsListParams = { page: 1, pageSize: 100 };

function toListQuery(p: CaptainsListParams) {
  return {
    page: p.page ?? 1,
    pageSize: p.pageSize ?? 50,
    ...(p.area ? { area: p.area } : {}),
    ...(p.isActive !== undefined ? { isActive: p.isActive } : {}),
    ...(p.availabilityStatus ? { availabilityStatus: p.availabilityStatus } : {}),
  };
}

export function useCaptains(params: CaptainsListParams = DEFAULT_CAPTAINS_LIST, options?: { enabled?: boolean }) {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  const can = role === "ADMIN" || role === "DISPATCHER";
  return useQuery({
    queryKey: queryKeys.captains.list(params),
    queryFn: () => api.captains.list(toListQuery(params)),
    enabled: (options?.enabled ?? true) && Boolean(token) && can,
  });
}
