import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { useAuthStore } from "@/stores/auth-store";

export function useDashboardSettings() {
  const token = useAuthStore((s) => s.token);
  const canAccess = useAuthStore((s) => {
    const r = s.user?.role;
    return r === "ADMIN" || r === "DISPATCHER";
  });

  return useQuery({
    queryKey: queryKeys.dashboard.settings(),
    queryFn: () => api.dashboardSettings.get(),
    enabled: Boolean(token) && canAccess,
    staleTime: 60_000,
  });
}
