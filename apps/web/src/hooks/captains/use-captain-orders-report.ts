import { useQuery } from "@tanstack/react-query";
import { queryKeys, type CaptainOrdersQueryParams } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { useAuthStore } from "@/stores/auth-store";

export function useCaptainOrdersReport(captainId: string | null, params: CaptainOrdersQueryParams, options?: { enabled?: boolean }) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: captainId ? queryKeys.captains.orders(captainId, params) : ["captains", "orders", "none"],
    queryFn: () => api.captains.orders(captainId!, params),
    enabled: Boolean(captainId) && (options?.enabled ?? true) && Boolean(token),
  });
}
